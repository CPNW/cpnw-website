
	    (function(){
	      const REVIEW_DECISIONS_KEY = 'cpnw-review-decisions-v1';
	      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
	      let currentReqContext = { sid: '', reqName: '', rerenderReqs: null };

	      function loadJSON(key, fallback){
	        try{
	          const raw = localStorage.getItem(key);
	          if (!raw) return fallback;
	          return JSON.parse(raw) ?? fallback;
	        }catch{
	          return fallback;
	        }
	      }

	      function saveJSON(key, value){
	        try{
	          localStorage.setItem(key, JSON.stringify(value));
	        }catch{
	          // ignore
	        }
	      }

	      function decisionKey(sid, reqName){
	        return `${String(sid || '').trim()}|${String(reqName || '').trim()}`.toLowerCase();
	      }

	      function getDecisionRecord(sid, reqName){
	        const store = loadJSON(REVIEW_DECISIONS_KEY, {});
	        if (!store || typeof store !== 'object' || Array.isArray(store)) return null;
	        return store[decisionKey(sid, reqName)] || null;
	      }

	      function saveDecisionRecord(sid, reqName, record){
	        const store = loadJSON(REVIEW_DECISIONS_KEY, {});
	        const next = (!store || typeof store !== 'object' || Array.isArray(store)) ? {} : store;
	        next[decisionKey(sid, reqName)] = record;
	        saveJSON(REVIEW_DECISIONS_KEY, next);
	      }

	      function decisionToStatus(decision){
	        const d = String(decision || '').toLowerCase();
	        if (d === 'approve' || d === 'approved') return 'Approved';
	        if (d === 'conditional' || d === 'conditionally approved' || d === 'conditionallyapprove' || d === 'conditionally') return 'Conditionally Approved';
	        if (d === 'reject' || d === 'rejected') return 'Rejected';
	        return '';
	      }

	      function setSavedHint(){
	        const el = document.getElementById('reqDecisionSaved');
	        if (!el) return;
	        el.classList.remove('d-none');
	        window.setTimeout(() => el.classList.add('d-none'), 2200);
	      }

	      function setUploadedList(files){
	        const wrap = document.getElementById('reqUploadedWrap');
	        const list = document.getElementById('reqUploadedList');
	        if (!wrap || !list) return;
	        const items = Array.isArray(files) ? files : [];
	        if (!items.length){
	          wrap.classList.add('d-none');
	          list.innerHTML = '';
	          return;
	        }
	        wrap.classList.remove('d-none');
	        list.innerHTML = items.map(f => {
	          const name = String(f?.name || 'File');
	          const at = f?.uploadedAt ? ` • ${String(f.uploadedAt)}` : '';
	          return `<li>${name}${at}</li>`;
	        }).join('');
	      }

	      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];

      const isHealthcareView = window.location.pathname.includes('/healthcare-views/');
      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
      const ASSIGNMENT_GRACE_DAYS = 14;
      const HEALTHCARE_REVIEWABLE_STATUSES = new Set(['Submitted', 'In Review']);
      const HEALTHCARE_EXPIRING_STATUSES = new Set(['Expired', 'Expiring', 'Expiring Soon']);
      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;

      const programDefs = [
        { id:'BSN', base: 12, aySpan: 2 },
        { id:'ADN', base: 10, aySpan: 2 },
        { id:'Surg Tech', base: 8, aySpan: 2 }
      ];
      const termAdjust = { Fall:3, Winter:1, Spring:0, Summer:-2 };
      const assignmentLocations = ['CPNW Medical Center','CPNW Healthcare Facility','Evergreen Health','Providence NW'];
      const assignmentStatusPool = ['approved','pending','rejected'];

      function normalize(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeProgramToken(value){
        const name = normalize(value).replace(/[^a-z0-9]/g, '');
        if (name.includes('surg')) return 'surgtech';
        if (name.includes('rad')) return 'radtech';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function formatProgramLabel(value){
        const name = normalize(value);
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return String(value || '').trim();
      }

      function hydrateAssignments(list){
        if (!Array.isArray(list)) return null;
        return list.map(item => {
          if (!item || typeof item !== 'object') return null;
          const start = item.start ? new Date(item.start) : null;
          const end = item.end ? new Date(item.end) : null;
          return { ...item, start, end };
        }).filter(Boolean);
      }

      function serializeAssignments(list){
        return (Array.isArray(list) ? list : []).map(item => ({
          ...item,
          start: item.start instanceof Date ? item.start.toISOString() : item.start,
          end: item.end instanceof Date ? item.end.toISOString() : item.end
        }));
      }

      function loadAssignments(){
        const stored = loadJSON(ASSIGNMENTS_KEY, null);
        if (!stored || !Array.isArray(stored)) return null;
        return hydrateAssignments(stored);
      }

      function saveAssignments(list){
        saveJSON(ASSIGNMENTS_KEY, serializeAssignments(list));
      }

      function getHealthcareFacilityNames(){
        if (!currentUser?.permissions?.canCoordinate) return new Set();
        const names = [
          currentUser.profile?.program,
          currentUser.profile?.school,
          ...(currentUser.programs || []),
          ...(currentUser.schools || [])
        ];
        return new Set(names.map(normalize).filter(Boolean));
      }

      function seedAssignmentsFromPeople(list){
        const assignments = [];
        list.forEach(person => {
          if (!person.studentId) return;
          const parts = String(person.studentId).split('-');
          const idx = Number(parts[0]) - 1;
          const i = Number(parts[1]) - 1;
          if (!Number.isFinite(idx) || !Number.isFinite(i)) return;
          const hasCurrentUpcoming = ((idx + i) % 5) !== 0;
          const hasPast = ((idx + i) % 3) !== 0;

          if (hasPast){
            const startPast = new Date(TODAY);
            startPast.setDate(startPast.getDate() - (120 + idx * 3 + i));
            const endPast = new Date(startPast);
            endPast.setDate(endPast.getDate() + 60);
            assignments.push({
              id: `a-past-${person.studentId}`,
              studentId: person.studentId,
              studentSid: person.sid,
              location: assignmentLocations[(i + idx) % assignmentLocations.length],
              start: startPast,
              end: endPast,
              status: assignmentStatusPool[(i + idx + 1) % assignmentStatusPool.length]
            });
          }

          if (hasCurrentUpcoming){
            const start = new Date(TODAY);
            start.setDate(start.getDate() + (idx * 8) + i * 2);
            const end = new Date(start);
            end.setDate(end.getDate() + 90);
            assignments.push({
              id: `a-cur-${person.studentId}`,
              studentId: person.studentId,
              studentSid: person.sid,
              location: assignmentLocations[(i + idx + 2) % assignmentLocations.length],
              start,
              end,
              status: assignmentStatusPool[(i + idx) % assignmentStatusPool.length]
            });
          }
        });
        return assignments;
      }

      function assignmentWithinWindow(assignment){
        const end = assignment?.end instanceof Date ? assignment.end : (assignment?.end ? new Date(assignment.end) : null);
        if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;
        const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const cutoff = new Date(endDate);
        cutoff.setDate(cutoff.getDate() + ASSIGNMENT_GRACE_DAYS);
        const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
        return cutoff >= today;
      }

      function assignmentMatchesFacility(assignment, facilityNames){
        if (!facilityNames.size) return false;
        const loc = normalize(assignment?.location);
        return facilityNames.has(loc);
      }

      function buildAssignmentEligibility(assignments, facilityNames){
        const ids = new Set();
        const sids = new Set();
        assignments.forEach(assignment => {
          if (!assignmentMatchesFacility(assignment, facilityNames)) return;
          if (!assignmentWithinWindow(assignment)) return;
          if (assignment.studentId) ids.add(String(assignment.studentId));
          if (assignment.studentSid) sids.add(String(assignment.studentSid));
        });
        return { ids, sids };
      }
      const cohortSeeds = [];
      programDefs.forEach(p => {
        Array.from({length:p.aySpan},(_,i)=>CURRENT_AY_START - i).forEach(ay=>{
          TERMS.forEach(term=>{
            const year = term === 'Fall' ? ay : ay + 1;
            const ayStart = term === 'Fall' ? ay : ay - 1;
            const students = Math.max(8, p.base + termAdjust[term] + (CURRENT_AY_START - ay));
            cohortSeeds.push({
              cohortLabel: `${p.id} – ${term} ${year}`,
              program: p.id,
              ayStart,
              students,
              school: (p.id === 'BSN' ? 'CPNW Education' : p.id === 'ADN' ? 'CPNW University' : 'CPNW Education')
            });
          });
        });
      });
      let cohorts = cohortSeeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);

      // Merge custom cohorts + membership deltas (stored in localStorage via main.js)
      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = cohortAPI ? cohortAPI.getMembershipCounts() : {};
      if (cohortAPI){
        cohorts = cohorts.map(c => {
          const delta = membershipCounts[cohortAPI.seedKeyForLabel(c.cohortLabel)] || 0;
          return { ...c, students: c.students + delta };
        });
        const schoolForProgram = (program) => (program === 'ADN' ? 'CPNW University' : 'CPNW Education');
        const custom = cohortAPI
          .listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX })
          .map(c => ({ ...c, school: schoolForProgram(c.program) }));
        cohorts = cohorts.concat(custom);
      }
      const cohortFilterEl = document.getElementById('cohortFilter');
      const cohortFilterWrap = cohortFilterEl?.closest('[data-cohort-filter]');
      const cohortFilterMenu = cohortFilterWrap?.querySelector('[data-cohort-menu]');

      const baseRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
        ? window.CPNW.getSharedRoster()
        : [];
      const people = baseRoster
        .filter(person => ['student','faculty','faculty-admin'].includes(person.role))
        .map(person => ({ ...person }));

      // Include faculty + faculty-admin accounts (education-role users are intentionally excluded from this table)
      function addPerson(raw){
        const person = { ...raw };
        if (cohortAPI){
          const override = typeof cohortAPI.getUserCohortLabel === 'function'
            ? cohortAPI.getUserCohortLabel(person.email)
            : null;
          if (override !== null && override !== undefined){
            person.cohort = override;
          }
        }
        people.push(person);
      }

      addPerson({
        name: 'Fran Faculty',
        email: 'fran.faculty@cpnw.org',
        program: 'BSN',
        school: 'CPNW Education',
        cohort: '',
        sid: 'EID-FF-001',
        verified: true,
        status: '',
        phone: '(555) 010-2000',
        emergName: '',
        emergPhone: '',
        dob: new Date(1988, 5, 12)
      });

      addPerson({
        name: 'Faculty Admin (Demo)',
        email: 'facadmin@cpnw.org',
        program: 'BSN',
        school: 'CPNW Education',
        cohort: '',
        sid: 'EID-FA-001',
        verified: true,
        status: '',
        phone: '(555) 010-2001',
        emergName: '',
        emergPhone: '',
        dob: new Date(1985, 9, 3)
      });

      const storedAssignments = loadAssignments();
      const assignments = storedAssignments || seedAssignmentsFromPeople(people);
      if (!storedAssignments){
        saveAssignments(assignments);
      }
      const facilityNames = getHealthcareFacilityNames();
      const assignmentEligibility = buildAssignmentEligibility(assignments, facilityNames);
      const programAccess = (window.CPNW && typeof window.CPNW.getProgramAccess === 'function')
        ? window.CPNW.getProgramAccess(currentUser)
        : [];
      const accessSummary = (window.CPNW && typeof window.CPNW.getProgramAccessSummary === 'function')
        ? window.CPNW.getProgramAccessSummary(currentUser)
        : { schools: [], programsBySchool: {}, programs: [] };
      const programAccessSet = new Set(
        programAccess.map(item => `${normalize(item.school)}|${normalizeProgramToken(item.program)}`)
      );

      const statusChipButtons = document.querySelectorAll('[data-status-chip]');
      const reviewTableBody = document.getElementById('reviewTableBody');
      const reviewSearch = document.getElementById('reviewSearch');
      const programFilter = document.getElementById('programFilter');
      const reviewPageSizeSelect = document.getElementById('reviewPageSize');
      const reviewPrevPage = document.getElementById('reviewPrevPage');
      const reviewNextPage = document.getElementById('reviewNextPage');
      const reviewPageInfo = document.getElementById('reviewPageInfo');
      const reviewTotal = document.getElementById('reviewTotal');
      const sortButtons = document.querySelectorAll('.sort');
      let currentStatusChip = 'all';
      let reviewPage = 1;
      let reviewPageSize = Number(reviewPageSizeSelect?.value || 10);
      let sortState = { field:'', dir:'asc' };

      function getProgramsBySchool(){
        if (!isHealthcareView && Object.keys(accessSummary.programsBySchool || {}).length){
          return accessSummary.programsBySchool;
        }
        const source = isHealthcareView
          ? people.filter(p => (p.studentId && assignmentEligibility.ids.has(p.studentId))
            || assignmentEligibility.sids.has(p.sid))
          : people;
        return source.reduce((acc, person) => {
          if (!person.school || !person.program) return acc;
          acc[person.school] ||= [];
          acc[person.school].push(person.program);
          return acc;
        }, {});
      }

      const programFilterWrap = programFilter?.closest('[data-program-filter]');
      const programFilterMenu = programFilterWrap?.querySelector('[data-program-menu]');
      const programFilterControl = (window.CPNW && typeof window.CPNW.buildProgramFilter === 'function')
        ? window.CPNW.buildProgramFilter({
          input: programFilter,
          menu: programFilterMenu,
          programsBySchool: getProgramsBySchool(),
          formatProgramLabel,
          onChange: () => {
            reviewPage = 1;
            updateCohortItems();
            renderReviews();
          }
        })
        : null;

      const cohortFilterControl = (isHealthcareView && window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
        ? window.CPNW.buildCheckboxMultiSelect({
          input: cohortFilterEl,
          menu: cohortFilterMenu,
          placeholder: 'All cohorts',
          onChange: () => {
            reviewPage = 1;
            renderReviews();
          }
        })
        : null;

      function getCohortItems(programSelections = []){
        const hasProgramSelections = programSelections.length > 0;
        const filtered = cohorts.filter(c => {
          if (!hasProgramSelections) return true;
          return programSelections.some(sel =>
            normalize(sel.school) === normalize(c.school)
            && normalizeProgramToken(sel.program) === normalizeProgramToken(c.program)
          );
        });
        const items = [];
        const seen = new Set();
        items.push({ value: '__unassigned__', label: 'Unassigned', group: '' });
        filtered.forEach(c => {
          if (seen.has(c.cohortLabel)) return;
          seen.add(c.cohortLabel);
          items.push({ value: c.cohortLabel, label: c.cohortLabel, group: c.school || '' });
        });
        return items;
      }

      function updateCohortItems(){
        if (cohortFilterControl){
          const selections = programFilterControl ? programFilterControl.getSelection() : [];
          cohortFilterControl.setItems(getCohortItems(selections));
          return;
        }
        if (cohortFilterEl){
          const options = ['', '__unassigned__'];
          cohorts.forEach(c => options.push(c.cohortLabel));
          cohortFilterEl.innerHTML = options.map(opt => {
            if (!opt) return `<option value="">All cohorts</option>`;
            if (opt === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
            return `<option value="${opt}">${opt}</option>`;
          }).join('');
        }
      }

      updateCohortItems();

      const CPNW_ELEARNING = [
        'Bloodborne Pathogens and Workplace Safety',
        'Emergency Procedures',
        'Patient Rights',
        'Infection Prevention and Standard Precautions',
        'Fall Risk Prevention',
        'Patient Safety',
        'Infectious Medical Waste',
        'Magnetic Resonance Imaging Safety',
        'Chemical Hazard Communication',
        'Compliance'
      ];
      const CPNW_REQUIREMENTS = [
        'CPNW: Varicella',
        'CPNW: Influenza',
        'CPNW: Tetanus, Diphtheria, & Pertussis',
        'CPNW: Criminal History Disclosure',
        'CPNW: BLS Provider Course',
        'CPNW: Tuberculin',
        'CPNW: Hepatitis B',
        'CPNW: Measles, Mumps, and Rubella',
        'CPNW: COVID-19',
        'CPNW: Independent Background Check',
        'CPNW: Independent WATCH'
      ];
      const reqCounts = { cpnw: CPNW_ELEARNING.length + CPNW_REQUIREMENTS.length, ed:4, hc:6 };
      const reqLabels = { cpnw:'CPNW', ed:'Education', hc:'Healthcare' };
      const freqOptions = ['Annual','Once','Seasonal'];
      const typePool = ['Immunization','Forms','Certs','Insurance','Licenses','Site Orientations'];
      const reviewerPool = ['Alexis Key', 'Jordan Price', 'Sam Patel'];
      const reqStatusPool = [
        'Not Submitted',
        'Submitted',
        'In Review',
        'Approved',
        'Conditionally Approved',
        'Rejected',
        'Declination',
        'Expired',
        'Expiring',
        'Expiring Soon'
      ];

      function datePlusDays(days){
        const d = new Date(TODAY);
        d.setDate(d.getDate() + days);
        return d;
      }

      function addYears(date, years){
        const d = new Date(date);
        d.setFullYear(d.getFullYear() + years);
        return d;
      }

      function seedFromPerson(person){
        const key = person?.sid || person?.email || person?.name || '';
        return Array.from(String(key)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      }

      function hasExpiringReq(person){
        const rows = buildReqs('complete', seedFromPerson(person), person.sid, person.email)
          .filter(r => r.category === 'CPNW Clinical Passport' || r.category === 'Education');
        const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
        const windowEnd = datePlusDays(30);
        return rows.some(r => {
          if (!r.expiration || !(r.expiration instanceof Date)) return false;
          const exp = new Date(r.expiration.getFullYear(), r.expiration.getMonth(), r.expiration.getDate());
          return exp < today || exp <= windowEnd;
        });
      }

      function getHealthcareReqSummary(person){
        const rows = buildReqs(
          'complete',
          seedFromPerson(person),
          person.sid,
          person.email
        ).filter(r => r.category === 'Healthcare');
        let hasReviewable = false;
        let hasExpiring = false;
        rows.forEach(r => {
          if (HEALTHCARE_REVIEWABLE_STATUSES.has(r.status)) hasReviewable = true;
          if (HEALTHCARE_EXPIRING_STATUSES.has(r.status)) hasExpiring = true;
        });
        return { hasReviewable, hasExpiring };
      }

      function getEducationReviewStatus(person){
        const rows = buildReqs(
          'complete',
          seedFromPerson(person),
          person.sid,
          person.email
        ).filter(r => r.category !== 'Healthcare' && r.type !== 'eLearning');
        const needsReview = rows.some(r => r.status === 'Submitted' || r.status === 'In Review');
        return needsReview ? 'needs-review' : '';
      }

      function isImmunizationRequirement(name){
        if (!name) return false;
        return /(covid|covid-19|hepatitis|influenza|varicella|measles|mumps|rubella|mmr|tetanus|diphtheria|pertussis|tdap|tb|tuberculin|vaccine|vaccination|immunization)/i.test(name);
      }

      function buildReqs(overallStatus, seed = 0, sid = '', studentEmail = ''){
        const rows = [];
        const seedOffset = Number.isFinite(seed) ? seed : 0;
        const studentKey = requirementsStore ? requirementsStore.resolveStudentKey({ sid, email: studentEmail }) : '';
        Object.entries(reqCounts).forEach(([key,count])=>{
          for(let i=1;i<=count;i++){
            const isCPNW = key === 'cpnw';
            const isElearning = isCPNW && i <= CPNW_ELEARNING.length;
            const baseType = isElearning ? 'eLearning' : typePool[(i + count) % typePool.length];
            const frequency = isElearning ? 'Annual' : freqOptions[i % freqOptions.length];
            const category = key === 'cpnw' ? 'CPNW Clinical Passport' : key === 'ed' ? 'Education' : 'Healthcare';
            const reviewer = isElearning ? '' : reviewerPool[i % reviewerPool.length];
            let status = reqStatusPool[(i + (overallStatus === 'needs-review' ? 1 : 3) + key.length + (seedOffset % reqStatusPool.length)) % reqStatusPool.length];
            if (isElearning){
              if (!['Not Submitted','Approved','Expired','Expiring Soon'].includes(status)){
                status = 'Not Submitted';
              }
            }
            const hasScore = isElearning && status !== 'Not Submitted';
            const scoreVal = hasScore ? 80 + (i % 21) : '';
            let exp = frequency === 'Once' ? null : new Date(TODAY.getFullYear(), TODAY.getMonth() + (6 + i), TODAY.getDate());
            const due = null;
            if (status === 'Not Submitted'){
              exp = null;
            }
            if (isElearning){
              if (status === 'Approved'){
                exp = datePlusDays(365);
              }else if (status === 'Expiring Soon'){
                exp = datePlusDays(20);
              }else if (status === 'Expired'){
                exp = datePlusDays(-7);
              }
            }
            const name = isCPNW
              ? (isElearning ? CPNW_ELEARNING[i - 1] : CPNW_REQUIREMENTS[i - 1 - CPNW_ELEARNING.length])
              : `${reqLabels[key]} Req ${i}`;
            if (sid === '1000' && (name === 'Bloodborne Pathogens and Workplace Safety' || name === 'Chemical Hazard Communication')){
              status = 'Approved';
              exp = datePlusDays(365);
            }
            let storedRecord = null;
            if (requirementsStore && studentKey){
              storedRecord = requirementsStore.getRecord(studentKey, name);
              if (storedRecord?.status){
                status = storedRecord.status;
              }else{
                status = requirementsStore.getStatus(studentKey, name, { category, isElearning });
              }
            }
            if (sid){
              const saved = getDecisionRecord(sid, name);
              const savedStatus = decisionToStatus(saved?.decision);
              if (savedStatus && (!storedRecord || storedRecord.source === 'seed')){
                status = savedStatus;
                if (requirementsStore){
                  requirementsStore.setStatus({ sid, email: studentEmail }, name, savedStatus, {
                    source: 'decision',
                    updatedAt: saved?.savedAt || saved?.at || new Date().toISOString()
                  });
                }
                if (status === 'Approved' || status === 'Conditionally Approved'){
                  if (frequency === 'Annual' || frequency === 'Seasonal'){
                    const baseDate = saved?.at ? new Date(saved.at) : TODAY;
                    exp = addYears(baseDate, 1);
                  }else{
                    exp = null;
                  }
                }else if (status === 'Rejected'){
                  exp = null;
                }
              }
            }
            const type = !isElearning && isImmunizationRequirement(name) ? 'Immunization' : baseType;

            rows.push({
              name,
              status,
              expiration: exp,
              dueDate: null,
              score: scoreVal,
              type,
              frequency,
              category,
              reviewer
            });
          }
        });
        return rows;
      }

      const messageThreads = {
        'CPNW: Hepatitis B': [
          [
            { from:'Student', to:['Education'], body:'I just uploaded my proof for Hep B.', at:'2025-02-01' },
            { from:'Education', to:['Student'], body:'Got it—please confirm the date on page 2 is signed.', at:'2025-02-02' }
          ]
        ],
        'CPNW: Criminal History Disclosure': [
          [
            { from:'Student', to:['Healthcare'], body:'Need clarification on site orientation steps.', at:'2025-02-03' },
            { from:'Healthcare', to:['Student'], body:'Please complete module 1 before Friday.', at:'2025-02-03' }
          ]
        ]
      };
      let currentReqThreadKey = '';
      let currentReplyThreadIndex = null;

      function statusBadge(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const map = {
          'needs-review': { text:'Needs review', cls:'text-bg-warning text-dark' },
          'expiring': { text:'Expiring/Expired', cls:'text-bg-danger' },
          'approved': { text:'Approved', cls:'text-bg-success' },
          'returned': { text:'Returned', cls:'text-bg-danger' }
        };
        const info = map[val] || { text: val, cls:'text-bg-secondary' };
        return `<span class="badge ${info.cls}">${info.text}</span>`;
      }

      function healthcareStatusBadge(summary){
        if (!summary) return '<span class="text-body-secondary">—</span>';
        if (summary.hasReviewable) return statusBadge('needs-review');
        if (summary.hasExpiring) return statusBadge('expiring');
        return '<span class="text-body-secondary">—</span>';
      }

      function renderReviews(){
        const q = (reviewSearch?.value || '').toLowerCase();
        const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
        const hasProgramSelections = programSelections.length > 0;
        const validCohorts = new Set([...cohorts.map(c=>c.cohortLabel), '__unassigned__']);
        const cohortSelections = cohortFilterControl
          ? cohortFilterControl.getSelection().filter(val => validCohorts.has(val))
          : (cohortFilterEl && validCohorts.has(cohortFilterEl.value) && cohortFilterEl.value ? [cohortFilterEl.value] : []);
        const cohortSet = new Set(cohortSelections);
        const hasCohortSelections = cohortSet.size > 0;
        const hcSummaryCache = isHealthcareView ? new Map() : null;

        function getHcSummary(person){
          if (!isHealthcareView) return null;
          const key = person.sid || person.studentId || person.email || person.name;
          if (hcSummaryCache.has(key)) return hcSummaryCache.get(key);
          const summary = getHealthcareReqSummary(person);
          hcSummaryCache.set(key, summary);
          return summary;
        }

        function getStatusValue(person){
          if (isHealthcareView){
            const summary = getHcSummary(person);
            if (summary?.hasReviewable) return 'needs-review';
            if (summary?.hasExpiring) return 'expiring';
            return '';
          }
          return getEducationReviewStatus(person);
        }

        const filtered = people.filter(p=>{
          if (isHealthcareView){
            const matchesAssignment = (p.studentId && assignmentEligibility.ids.has(p.studentId))
              || assignmentEligibility.sids.has(p.sid);
            if (!matchesAssignment) return false;
            const summary = getHcSummary(p);
            if (currentStatusChip === 'needs-review' && !summary.hasReviewable) return false;
            if (currentStatusChip === 'expiring' && !summary.hasExpiring) return false;
          }else{
            if (programAccessSet.size){
              const key = `${normalize(p.school)}|${normalizeProgramToken(p.program)}`;
              if (!programAccessSet.has(key)) return false;
            }
            if (currentStatusChip === 'expiring'){
              if (!hasExpiringReq(p)) return false;
            }else if (currentStatusChip !== 'all' && getStatusValue(p) !== currentStatusChip){
              return false;
            }
          }
          if (hasCohortSelections){
            const cohortLabel = (p.cohort || '').trim();
            const wantsUnassigned = cohortSet.has('__unassigned__');
            if (!cohortLabel){
              if (!wantsUnassigned) return false;
            }else if (!cohortSet.has(cohortLabel)){
              return false;
            }
          }
          if (hasProgramSelections){
            const matchesProgram = programSelections.some(sel =>
              normalize(sel.school) === normalize(p.school)
              && normalizeProgramToken(sel.program) === normalizeProgramToken(p.program)
            );
            if (!matchesProgram) return false;
          }
          if (q && !`${p.name} ${p.sid} ${p.email}`.toLowerCase().includes(q)) return false;
          return true;
        });

        // Needs review first, then blanks
        filtered.sort((a,b)=>{
          const aNeeds = a.status === 'needs-review' ? 0 : 1;
          const bNeeds = b.status === 'needs-review' ? 0 : 1;
          if (aNeeds !== bNeeds) return aNeeds - bNeeds;

          const field = sortState.field;
          const dir = sortState.dir === 'desc' ? -1 : 1;
          if (!field){
            return a.name.localeCompare(b.name);
          }
          const valA = (field === 'status' ? getStatusValue(a) : (a[field] ?? '')).toString().toLowerCase();
          const valB = (field === 'status' ? getStatusValue(b) : (b[field] ?? '')).toString().toLowerCase();
          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
          return a.name.localeCompare(b.name);
        });

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / reviewPageSize));
        if (reviewPage > totalPages) reviewPage = totalPages;
        const startIdx = (reviewPage - 1) * reviewPageSize;
        const endIdx = Math.min(startIdx + reviewPageSize, total);
        const pageItems = filtered.slice(startIdx, endIdx);

        reviewTableBody.innerHTML = pageItems.map(p=>`
          <tr>
            <td class="fw-semibold">${p.name}</td>
            <td>${p.verified ? '✓' : ''}</td>
            <td>${isHealthcareView ? healthcareStatusBadge(getHcSummary(p)) : statusBadge(getStatusValue(p))}</td>
            <td>${p.program}</td>
            <td>${p.school}</td>
            <td>${p.cohort ? p.cohort : '<span class="text-body-secondary">Unassigned</span>'}</td>
            <td>${p.sid}</td>
            <td class="text-end"><button class="btn btn-outline-secondary btn-sm" data-review="${p.sid}">View</button></td>
          </tr>
        `).join('');

        if (reviewPageInfo){
          reviewPageInfo.textContent = total ? `Showing ${startIdx + 1}–${endIdx} of ${total}` : 'No results';
        }
        if (reviewPrevPage && reviewNextPage){
          reviewPrevPage.disabled = reviewPage <= 1;
          reviewNextPage.disabled = endIdx >= total;
        }
      }

      statusChipButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          statusChipButtons.forEach(b=>{
            b.classList.remove('btn-cpnw','btn-cpnw-primary');
            b.classList.add('btn-outline-secondary');
          });
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
          currentStatusChip = btn.dataset.statusChip;
          reviewPage = 1;
          renderReviews();
        });
      });

      [reviewSearch, cohortFilterEl].forEach(el=>{
        if (!el) return;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', ()=>{
          reviewPage = 1;
          renderReviews();
        });
      });

      reviewPageSizeSelect?.addEventListener('change', ()=>{
        reviewPageSize = Number(reviewPageSizeSelect.value || 10);
        reviewPage = 1;
        renderReviews();
      });

      reviewPrevPage?.addEventListener('click', ()=>{
        if (reviewPage > 1){
          reviewPage -= 1;
          renderReviews();
        }
      });
      reviewNextPage?.addEventListener('click', ()=>{
        reviewPage += 1;
        renderReviews();
      });

      // initialize status buttons (set "All" active)
      statusChipButtons.forEach(btn=>{
        if (btn.dataset.statusChip === 'all'){
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
        }
      });

      sortButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const field = btn.dataset.sort;
          if (!field) return;
          if (sortState.field === field){
            sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
          }else{
            sortState = { field, dir:'asc' };
          }
          renderReviews();
        });
      });

      function openReviewModal(person){
        if (!person) return;
        const sid = person.sid;
        document.getElementById('reviewModalLabel').textContent = person.name;
        document.getElementById('reviewModalSub').textContent = person.email;
        document.getElementById('modalSchool').textContent = person.school;
        document.getElementById('modalProgram').textContent = person.program;
        document.getElementById('modalCohort').textContent = person.cohort;
        document.getElementById('modalSid').textContent = person.sid;
        document.getElementById('modalEmail').textContent = person.email;
        document.getElementById('modalPhone').textContent = person.phone || '—';
        document.getElementById('modalEmergName').textContent = person.emergName || '—';
        document.getElementById('modalEmergPhone').textContent = person.emergPhone || '—';
        document.getElementById('modalDob').textContent = person.dob ? person.dob.toLocaleDateString() : '—';

        // Clinical assignments (sample)
        const assignBody = document.getElementById('assignTableBody');
        const assignStatuses = ['Approved','Rejected',''];
        const assignRows = Array.from({length:3},(_,i)=>{
          const start = new Date(TODAY);
          start.setDate(start.getDate() - (60 - i*10));
          const end = new Date(start);
          end.setDate(end.getDate() + 60);
          return {
            location: i % 2 === 0 ? 'CPNW Medical Center' : 'CPNW Healthcare Facility',
            start,
            end,
            status: assignStatuses[(i + person.sid.length) % assignStatuses.length]
          };
        });
        assignBody.innerHTML = assignRows.map(a=>`
          <tr>
            <td>${a.location}</td>
            <td>${a.start.toLocaleDateString()}</td>
            <td>${a.end.toLocaleDateString()}</td>
            <td>${a.status || '—'}</td>
          </tr>
        `).join('');

        // Requirements with pagination within modal
        let reqPageSize = Number(document.getElementById('reqPageSize')?.value || 10);
        let reqPage = 1;
        let reqSortKey = 'grouped';
        let reqSortDir = 'asc';
        const reqRows = buildReqs('complete', seedFromPerson(person), person.sid, person.email);
        const orderedReqs = isHealthcareView
          ? [
            ...reqRows.filter(r => r.category === 'Healthcare'),
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type !== 'eLearning'),
            ...reqRows.filter(r => r.category === 'Education'),
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type === 'eLearning')
          ]
          : [
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type !== 'eLearning'),
            ...reqRows.filter(r => r.category === 'Education'),
            ...reqRows.filter(r => r.category === 'Healthcare'),
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type === 'eLearning')
          ];
        const reqBody = document.getElementById('reqTableBody');
        const reqTable = document.getElementById('reqTable');
        const reqSortButtons = reqTable ? reqTable.querySelectorAll('.req-sort') : [];
        const fmt = (d) => d instanceof Date ? d.toLocaleDateString() : '—';
        const reqPrev = document.getElementById('reqPrev');
        const reqNext = document.getElementById('reqNext');
        const reqPageInfo = document.getElementById('reqPageInfo');

        function getEffectiveStatus(r){
          let effectiveStatus = r.status;
          if (requirementsStore){
            const stored = requirementsStore.getStatus(
              { sid: person.sid, email: person.email },
              r.name,
              { category: r.category, isElearning: r.type === 'eLearning' }
            );
            if (stored) effectiveStatus = stored;
          }else{
            const saved = getDecisionRecord(person.sid, r.name);
            const savedStatus = decisionToStatus(saved?.decision);
            if (savedStatus) effectiveStatus = savedStatus;
          }
          if (r.type === 'eLearning' && !['Not Submitted','Approved','Expired','Expiring Soon'].includes(effectiveStatus)){
            effectiveStatus = 'Not Submitted';
          }
          return effectiveStatus;
        }

        function compareValues(a, b){
          if (a == null && b == null) return 0;
          if (a == null) return 1;
          if (b == null) return -1;
          if (a instanceof Date && b instanceof Date) return a - b;
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        }

        function updateSortIndicators(){
          if (!reqTable) return;
          reqTable.querySelectorAll('th').forEach(th=>{
            const btn = th.querySelector('.req-sort');
            const key = btn?.dataset?.sort;
            if (!key) return;
            if (key === reqSortKey){
              th.setAttribute('aria-sort', reqSortDir === 'asc' ? 'ascending' : 'descending');
            } else {
              th.setAttribute('aria-sort', 'none');
            }
          });
        }

        function renderReqs(){
          const total = orderedReqs.length;
          const totalPages = Math.max(1, Math.ceil(total / reqPageSize));
          if (reqPage > totalPages) reqPage = totalPages;
          const start = (reqPage - 1) * reqPageSize;
          const end = Math.min(start + reqPageSize, total);
          const groupRank = isHealthcareView
            ? {
              'Healthcare': 0,
              'CPNW Clinical Passport': 1,
              'Education': 2
            }
            : {
              'CPNW Clinical Passport': 0,
              'Education': 1,
              'Healthcare': 2
            };
          const sortMap = {
            grouped: (r) => r,
            name: (r) => r.name,
            status: (r) => getEffectiveStatus(r),
            expiration: (r) => r.expiration,
            type: (r) => r.type,
            frequency: (r) => r.frequency,
            category: (r) => r.category,
            reviewer: (r) => r.reviewer
          };
          const sortFn = sortMap[reqSortKey] || sortMap.name;
          const sortedReqs = [...orderedReqs].sort((a, b)=>{
            if (reqSortKey === 'grouped'){
              const aRank = a.type === 'eLearning' ? 3 : (groupRank[a.category] ?? 3);
              const bRank = b.type === 'eLearning' ? 3 : (groupRank[b.category] ?? 3);
              const groupResult = aRank - bRank;
              if (groupResult !== 0) return reqSortDir === 'asc' ? groupResult : -groupResult;
              const nameResult = compareValues(a.name, b.name);
              return reqSortDir === 'asc' ? nameResult : -nameResult;
            }
            const result = compareValues(sortFn(a), sortFn(b));
            return reqSortDir === 'asc' ? result : -result;
          });
          const pageItems = sortedReqs.slice(start, end);
	        reqBody.innerHTML = pageItems.map((r, idx)=>{
	          const effectiveStatus = getEffectiveStatus(r);
	          let statusBadge = '<span class="badge text-bg-secondary">Not Submitted</span>';
	          const statusMap = {
	            'Not Submitted':'text-bg-secondary',
	            'Submitted':'text-bg-info text-dark',
	            'In Review':'text-bg-warning text-dark',
	            'Approved':'text-bg-success',
	            'Conditionally Approved':'text-bg-primary',
	            'Rejected':'text-bg-danger',
	            'Declination':'text-bg-danger-subtle text-danger',
	            'Expired':'text-bg-dark',
	            'Expiring':'text-bg-warning text-dark',
	            'Expiring Soon':'text-bg-warning text-dark'
	          };
	            if (effectiveStatus && statusMap[effectiveStatus]){
	              statusBadge = `<span class="badge ${statusMap[effectiveStatus]}">${effectiveStatus}</span>`;
	            }
          const abbr = r.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,6);
          const requiredBy = r.category === 'CPNW Clinical Passport' ? 'CPNW' : r.category === 'Education' ? 'Education' : 'CPNW Healthcare Facility';
          const nameCell = r.type === 'eLearning'
            ? `<span class="text-body-secondary text-start">${r.name}</span>`
            : `<button class="btn btn-link p-0 text-decoration-none text-start req-detail-btn" data-req-detail="1" data-req-index="${start + idx}" data-req-name="${r.name}" data-req-abbr="${abbr}" data-req-requiredby="${requiredBy}" data-req-instructions="Follow the instructions to submit required proof for ${r.name}." data-req-category="${r.category}">${r.name}</button>`;
          return `
            <tr>
              <td class="text-start">${nameCell}</td>
              <td>${statusBadge}</td>
              <td>${fmt(r.expiration)}</td>
              <td>${r.type}</td>
              <td>${r.frequency}</td>
              <td>${r.category}</td>
              <td>${r.reviewer}</td>
            </tr>
          `;
          }).join('');

          if (reqPageInfo){
            reqPageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
          }
          if (reqPrev && reqNext){
            reqPrev.disabled = reqPage <= 1;
            reqNext.disabled = end >= total;
          }
        }

        reqSortButtons.forEach(btn=>{
          btn.addEventListener('click', () => {
            const key = btn.dataset.sort;
            if (!key) return;
            if (reqSortKey === key){
              reqSortDir = reqSortDir === 'asc' ? 'desc' : 'asc';
            } else {
              reqSortKey = key;
              reqSortDir = 'asc';
            }
            reqPage = 1;
            updateSortIndicators();
            renderReqs();
          });
        });
        updateSortIndicators();

        const reqPageSizeSelect = document.getElementById('reqPageSize');
        if (reqPageSizeSelect){
          reqPageSizeSelect.onchange = () => {
            reqPageSize = Number(reqPageSizeSelect.value || 10);
            reqPage = 1;
            renderReqs();
          };
        }

        reqPrev?.addEventListener('click', ()=>{
          if (reqPage > 1){
            reqPage -= 1;
            renderReqs();
          }
        });
        reqNext?.addEventListener('click', ()=>{
          reqPage += 1;
          renderReqs();
        });

	        renderReqs();
	        const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
	        modal.show();
        const reviewModalEl = document.getElementById('reviewModal');
        reviewModalEl.dataset.studentName = person.name;
        reviewModalEl.dataset.studentSid = person.sid;
        reviewModalEl.dataset.studentEmail = person.email;
        currentReqContext = { sid: person.sid, reqName: '', rerenderReqs: renderReqs, email: person.email };
      }

      function renderThread(){
        const threadWrap = document.getElementById('msgThread');
        if (!threadWrap) return;
        let threads = messageThreads[currentReqThreadKey] || [];
        // Backward compatibility: if stored as flat array, wrap as single thread
        if (threads.length && !Array.isArray(threads[0])){
          threads = [threads];
          messageThreads[currentReqThreadKey] = threads;
        }
        if (!threads.length){
          threadWrap.innerHTML = '<div class="text-body-secondary small">No messages yet.</div>';
          return;
        }
        threadWrap.innerHTML = threads.map((msgs, threadIdx)=>`
          <div class="border rounded p-2">
            <div class="small fw-semibold mb-1">Thread ${threadIdx + 1}</div>
            ${msgs.map(m=>`
              <div class="border rounded p-2 mb-2">
                <div class="small fw-semibold">${m.from} → ${m.to.join(', ')}</div>
                <div class="small text-body-secondary">${m.at || ''}</div>
                <div class="small mb-1">${m.body}</div>
                <button class="btn btn-link p-0 small msg-reply" type="button" data-reply-thread="${threadIdx}" data-reply-to="${m.from}" data-reply-recipients="${m.to.join('|')}">Reply</button>
              </div>
            `).join('')}
          </div>
        `).join('');
      }

      // requirement detail click (delegate)
      document.addEventListener('click', (ev)=>{
        const btn = ev.target.closest('.req-detail-btn');
        if (!btn) return;
        const name = btn.dataset.reqName || '';
        const abbr = btn.dataset.reqAbbr || '';
        const requiredBy = btn.dataset.reqRequiredby || '';
        const instructions = btn.dataset.reqInstructions || '';
        const category = btn.dataset.reqCategory || '';
        const student = btn.closest('#reviewModal')?.dataset?.studentName || document.getElementById('reqDetailStudent')?.textContent || '';
        const sid = btn.closest('#reviewModal')?.dataset?.studentSid || '';
        const studentEmail = btn.closest('#reviewModal')?.dataset?.studentEmail || '';
        document.getElementById('reqDetailStudent').textContent = student;
        const studentEmailEl = document.getElementById('reqDetailStudentEmail');
        if (studentEmailEl) studentEmailEl.textContent = studentEmail;
        document.getElementById('reqDetailModalLabel').textContent = name;
	        document.getElementById('reqDetailMeta').textContent = `Abbreviation: ${abbr} • Required by: ${requiredBy}`;
	        document.getElementById('reqDetailInstructions').textContent = instructions;
        const msgRecipient = document.getElementById('msgRecipient');
        if (msgRecipient){
          const options = [
            { value:'Student', label:'Student' },
            { value:'Healthcare', label:'Healthcare' }
          ];
          if (category === 'CPNW Clinical Passport'){
            options.splice(1,0,{ value:'CPNW Reviewer', label:'CPNW Reviewer' });
          }
          msgRecipient.innerHTML = options.map(opt=>`
            <label class="form-check d-flex align-items-center gap-2">
              <input class="form-check-input" type="checkbox" value="${opt.value}">
              <span>${opt.label}</span>
            </label>
          `).join('');
	        }
	        // reset decision/notes
	        document.querySelectorAll('.req-submission').forEach(r=>r.checked=false);
	        document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
	        document.querySelectorAll('.decision-radio').forEach(r=>r.checked=false);
	        document.getElementById('decisionReasonWrap').classList.add('d-none');
	        const reasonEl = document.getElementById('decisionReason');
	        if (reasonEl) reasonEl.value = '';
	        const vaccDate = document.getElementById('vaccDate');
	        const seriesStart = document.getElementById('seriesStart');
	        const seriesDue = document.getElementById('seriesDue');
	        const otherNotes = document.getElementById('otherNotes');
	        if (vaccDate) vaccDate.value = '';
	        if (seriesStart) seriesStart.value = '';
	        if (seriesDue) seriesDue.value = '';
	        if (otherNotes) otherNotes.value = '';
	        ['declEgg','declIngredient','declGB','declOther'].forEach(id=>{
	          const el = document.getElementById(id);
	          if (el) el.checked = false;
	        });
	        const uploadEl = document.getElementById('reqUpload');
	        if (uploadEl) uploadEl.value = '';
	        setUploadedList([]);

	        const decisionWrap = document.getElementById('reqDecisionSave')?.closest('.mb-3');
	        let decisionNote = document.getElementById('decisionRestrictionNote');
	        if (!decisionNote && decisionWrap){
	          decisionNote = document.createElement('div');
	          decisionNote.id = 'decisionRestrictionNote';
	          decisionNote.className = 'small text-body-secondary mt-2 d-none';
	          decisionNote.textContent = 'Review decisions are limited to Healthcare requirements.';
	          decisionWrap.appendChild(decisionNote);
	        }
	        const lockDecisions = isHealthcareView && category !== 'Healthcare';
	        document.querySelectorAll('.decision-radio').forEach(r=>r.disabled = lockDecisions);
	        const decisionReason = document.getElementById('decisionReason');
	        if (decisionReason) decisionReason.disabled = lockDecisions;
	        const decisionSave = document.getElementById('reqDecisionSave');
	        if (decisionSave) decisionSave.disabled = lockDecisions;
	        if (decisionNote) decisionNote.classList.toggle('d-none', !lockDecisions);

	        // Load saved decision if present
	        if (sid){
	          const saved = getDecisionRecord(sid, name);
	          if (saved){
	            const submission = String(saved.submission?.type || '');
	            if (submission){
	              const subEl = document.getElementById(submission);
	              if (subEl){
	                subEl.checked = true;
	                document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
	                const targetId = subEl.dataset.target;
	                if (targetId){
	                  document.getElementById(targetId)?.classList.remove('d-none');
	                }
	              }
	            }
	            if (vaccDate) vaccDate.value = saved.submission?.vaccDate || '';
	            if (seriesStart) seriesStart.value = saved.submission?.seriesStart || '';
	            if (seriesDue) seriesDue.value = saved.submission?.seriesDue || '';
	            if (otherNotes) otherNotes.value = saved.submission?.otherNotes || '';

	            const decl = saved.declination || {};
	            const declEgg = document.getElementById('declEgg');
	            const declIngredient = document.getElementById('declIngredient');
	            const declGB = document.getElementById('declGB');
	            const declOther = document.getElementById('declOther');
	            if (declEgg) declEgg.checked = !!decl.egg;
	            if (declIngredient) declIngredient.checked = !!decl.ingredient;
	            if (declGB) declGB.checked = !!decl.gb;
	            if (declOther) declOther.checked = !!decl.other;

	            const decision = String(saved.decision || '').toLowerCase();
	            const decApprove = document.getElementById('decApprove');
	            const decConditional = document.getElementById('decConditional');
	            const decReject = document.getElementById('decReject');
	            if (decApprove) decApprove.checked = decision === 'approve' || decision === 'approved';
	            if (decConditional) decConditional.checked = decision === 'conditional' || decision === 'conditionally approved';
	            if (decReject) decReject.checked = decision === 'reject' || decision === 'rejected';

	            const needsReason = !!decConditional?.checked || !!decReject?.checked;
	            document.getElementById('decisionReasonWrap')?.classList.toggle('d-none', !needsReason);
	            if (reasonEl) reasonEl.value = saved.decisionReason || '';
	            setUploadedList(saved.uploads || []);
	          }
	        }

	        const reviewModalEl = document.getElementById('reviewModal');
	        const reviewModalInstance = reviewModalEl ? bootstrap.Modal.getInstance(reviewModalEl) || new bootstrap.Modal(reviewModalEl) : null;
	        const reqModalEl = document.getElementById('reqDetailModal');
	        const reqModal = new bootstrap.Modal(reqModalEl);
	        reqModalEl.dataset.reqSid = sid;
	        reqModalEl.dataset.reqName = name;
	        currentReqContext = { ...currentReqContext, sid, reqName: name, category };

	        window.__reviewWasOpen = reviewModalEl?.classList.contains('show');
        if (window.__reviewWasOpen && reviewModalInstance){
          reviewModalInstance.hide();
        }
        currentReqThreadKey = name;
        currentReplyThreadIndex = null;
        renderThread();
        reqModal.show();
      });

      document.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-review]');
        if (!btn) return;
        const sid = btn.dataset.review;
        const person = people.find(p=>p.sid === sid);
        if (!person) return;
        openReviewModal(person);
      });

      // submission radio toggle
      document.addEventListener('change', (e)=>{
        if (!e.target.classList.contains('req-submission')) return;
        document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
        const targetId = e.target.dataset.target;
        if (targetId){
          const tgt = document.getElementById(targetId);
          if (tgt) tgt.classList.remove('d-none');
        }
      });

      // decision reason toggle
      document.addEventListener('change', (e)=>{
        if (!e.target.classList.contains('decision-radio')) return;
        const requires = e.target.hasAttribute('data-requires-reason');
        const wrap = document.getElementById('decisionReasonWrap');
        if (wrap){
          wrap.classList.toggle('d-none', !requires);
        }
      });

      // Save decision + submission/declination + uploads (demo persistence)
      document.addEventListener('click', (e) => {
        if (e.target.id !== 'reqDecisionSave') return;
        const modalEl = document.getElementById('reqDetailModal');
        const sid = modalEl?.dataset?.reqSid || '';
        const reqName = modalEl?.dataset?.reqName || document.getElementById('reqDetailModalLabel')?.textContent || '';
        if (!sid || !reqName){
          alert('Unable to save: missing student/requirement context.');
          return;
        }

        if (isHealthcareView && currentReqContext?.category !== 'Healthcare'){
          alert('Healthcare users can only review Healthcare requirements.');
          return;
        }

        const decision =
          document.getElementById('decApprove')?.checked ? 'Approved' :
          document.getElementById('decConditional')?.checked ? 'Conditionally Approved' :
          document.getElementById('decReject')?.checked ? 'Rejected' :
          '';
        const decisionReason = (document.getElementById('decisionReason')?.value || '').trim();
        if ((decision === 'Conditionally Approved' || decision === 'Rejected') && !decisionReason){
          alert('Please enter a reason for conditional approval or rejection.');
          return;
        }

        const submissionType = document.getElementById('subVaccinated')?.checked ? 'subVaccinated' :
          document.getElementById('subSeries')?.checked ? 'subSeries' :
          document.getElementById('subOther')?.checked ? 'subOther' :
          '';

        const existing = getDecisionRecord(sid, reqName) || {};
        const existingUploads = Array.isArray(existing.uploads) ? existing.uploads.slice() : [];
        const files = Array.from(document.getElementById('reqUpload')?.files || []);
        const newUploads = files.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
          uploadedAt: new Date().toISOString().slice(0, 10)
        }));

        const record = {
          savedAt: new Date().toISOString(),
          decision,
          decisionReason,
          submission: {
            type: submissionType,
            vaccDate: document.getElementById('vaccDate')?.value || '',
            seriesStart: document.getElementById('seriesStart')?.value || '',
            seriesDue: document.getElementById('seriesDue')?.value || '',
            otherNotes: (document.getElementById('otherNotes')?.value || '').trim()
          },
          declination: {
            egg: !!document.getElementById('declEgg')?.checked,
            ingredient: !!document.getElementById('declIngredient')?.checked,
            gb: !!document.getElementById('declGB')?.checked,
            other: !!document.getElementById('declOther')?.checked
          },
          uploads: existingUploads.concat(newUploads)
        };

        saveDecisionRecord(sid, reqName, record);
        if (requirementsStore && decision){
          requirementsStore.setDecision(
            { sid, email: currentReqContext?.email || '' },
            reqName,
            decision,
            { source: 'decision', updatedAt: record.savedAt }
          );
        }
        const uploadEl = document.getElementById('reqUpload');
        if (uploadEl) uploadEl.value = '';
        setUploadedList(record.uploads);
        setSavedHint();

        if (typeof currentReqContext?.rerenderReqs === 'function' && currentReqContext.sid === sid){
          currentReqContext.rerenderReqs();
        }
      });

      // send message
      document.addEventListener('click', (e)=>{
        if (e.target.id !== 'msgSend') return;
        const recipients = Array.from(document.querySelectorAll('#msgRecipient input:checked')).map(i=>i.value);
        const body = document.getElementById('msgBody')?.value.trim() || '';
        if (!recipients.length || !body){
          alert('Please select at least one recipient and enter a message.');
          return;
        }
        const thread = messageThreads[currentReqThreadKey] || [];
        // Ensure thread structure
        let threads = thread;
        if (threads.length && !Array.isArray(threads[0])) threads = [threads];
        if (!threads.length) threads = [];
        if (currentReplyThreadIndex === null){
          // new thread
          threads.push([{ from:'Education', to: recipients, body, at: new Date().toLocaleString() }]);
        }else{
          const target = threads[currentReplyThreadIndex] || [];
          target.push({ from:'Education', to: recipients, body, at: new Date().toLocaleString() });
          threads[currentReplyThreadIndex] = target;
        }
        messageThreads[currentReqThreadKey] = threads;
        document.getElementById('msgBody').value = '';
        currentReplyThreadIndex = null;
        renderThread();
      });

      // reply button populate recipients and hint
      document.addEventListener('click', (e)=>{
        const replyBtn = e.target.closest('.msg-reply');
        if (!replyBtn) return;
        const recips = (replyBtn.dataset.replyRecipients || '').split('|').filter(Boolean);
        document.querySelectorAll('#msgRecipient input').forEach(cb=>{
          cb.checked = recips.includes(cb.value);
        });
        const body = document.getElementById('msgBody');
        if (body){
          const to = replyBtn.dataset.replyTo ? `@${replyBtn.dataset.replyTo}: ` : '';
          body.value = to;
          body.focus();
        }
        const threadIdx = replyBtn.dataset.replyThread;
        currentReplyThreadIndex = threadIdx ? Number(threadIdx) : null;
      });

      // When req detail closes, re-show review modal if it was open
      const reqDetailModalEl = document.getElementById('reqDetailModal');
      if (reqDetailModalEl){
        reqDetailModalEl.addEventListener('hidden.bs.modal', ()=>{
          if (window.__reviewWasOpen){
            const reviewModalEl = document.getElementById('reviewModal');
            const reviewModalInstance = reviewModalEl ? bootstrap.Modal.getInstance(reviewModalEl) || new bootstrap.Modal(reviewModalEl) : null;
            reviewModalInstance?.show();
            window.__reviewWasOpen = false;
          }
        });
      }

      renderReviews();

      if (isHealthcareView){
        const sidParam = new URLSearchParams(window.location.search).get('sid');
        if (sidParam){
          const person = people.find(p => String(p.sid) === String(sidParam));
          if (person) openReviewModal(person);
        }
      }
    })();
  
