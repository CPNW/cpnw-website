
    (() => {
      // Cohort / academic year helpers
      const TODAY = new Date(); // derive AY from the actual current date
      const FALL_START_MONTH = 7; // August (0-based)
      const THIS_YEAR = TODAY.getFullYear();
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? THIS_YEAR : THIS_YEAR - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall', 'Winter', 'Spring', 'Summer'];

      function deriveAY(term, startYear){
        const year = Number(startYear);
        const isFall = term.toLowerCase() === 'fall';
        const ayStart = isFall ? year : year - 1;
        const ayEnd = ayStart + 1;
        return {
          ayStart,
          ayEnd,
          ayLabel: `${ayStart}–${ayEnd}`
        };
      }

      function buildCohort({ programId, programName, term, year, students, approvedAssignments, requirementsReview, expiringStudents }){
        const { ayStart, ayEnd, ayLabel } = deriveAY(term, year);
        const label = `${programName} – ${term} ${year}`;
        const archived = ayStart <= CURRENT_AY_START - 4; // older than visible window
        const visibleByDefault = ayStart >= AY_VISIBLE_MIN && ayStart <= AY_VISIBLE_MAX && !archived;
        return {
          programId,
          programName,
          term,
          startYear: year,
          ayStart,
          ayEnd,
          ayLabel,
          label,
          archived,
          visibleByDefault,
          students,
          approvedAssignments,
          requirementsReview,
          expiringStudents
        };
      }

      const programDefs = [
        { id: 'bsn', name: 'BSN', base: 12, aySpan: 2 },
        { id: 'adn', name: 'ADN', base: 10, aySpan: 2 },
        { id: 'surg', name: 'Surgical Technology', base: 8, aySpan: 2 },
        { id: 'rad', name: 'Radiologic Technology', base: 6, aySpan: 2 },
        { id: 'resp', name: 'Respiratory Care', base: 7, aySpan: 2 },
        { id: 'med', name: 'Medical Assistant', base: 6, aySpan: 2 },
        { id: 'sono', name: 'Diagnostic Medical Sonography', base: 6, aySpan: 2 }
      ];

      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;
      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
      const nameTarget = document.querySelector('[data-current-user-name]');
      if (nameTarget && currentUser?.name){
        nameTarget.textContent = currentUser.name;
      }

      function programIdFromName(name){
        const n = String(name || '').toLowerCase();
        if (n.includes('bsn')) return 'bsn';
        if (n.includes('adn')) return 'adn';
        if (n.includes('surg')) return 'surg';
        if (n.includes('rad')) return 'rad';
        if (n.includes('resp')) return 'resp';
        if (n.includes('medassistant') || n.includes('medassist')) return 'med';
        if (n.includes('sonography') || n.includes('sono') || n.includes('dms')) return 'sono';
        return '';
      }

      function normalize(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeEmail(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeSchool(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'surg tech';
        if (name.includes('rad')) return 'radiologic technology';
        if (name.includes('resp')) return 'respiratory care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'diagnostic medical sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'medical assistant';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function normalizeProgramToken(value){
        const name = normalize(value).replace(/[^a-z0-9]/g, '');
        if (name.includes('surg')) return 'surgtech';
        if (name.includes('rad')) return 'radtech';
        if (name.includes('resp')) return 'respcare';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'medicalassistant';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function cohortKey(label){
        const raw = String(label || '').trim();
        if (!raw) return 'unassigned';
        const lowered = raw.toLowerCase();
        if (lowered === 'unassigned') return 'unassigned';
        const match = raw.match(/^(.*?)\s*[–-]\s*(Fall|Winter|Spring|Summer)\s*(\d{4})$/i);
        if (!match) return normalize(raw);
        const program = normalizeProgramToken(match[1]);
        const term = String(match[2] || '').toLowerCase();
        const year = match[3];
        return `${program}|${term}|${year}`;
      }

      const termAdjust = { Fall: 3, Winter: 1, Spring: 0, Summer: -2 };

      const cohortSeeds = [];
      programDefs.forEach(p => {
        const ayStarts = Array.from({length: p.aySpan}, (_, i) => CURRENT_AY_START - i);
        ayStarts.forEach(ay => {
          TERMS.forEach(term => {
            const students = Math.max(8, p.base + termAdjust[term] + (CURRENT_AY_START - ay)); // keep counts reasonable
            const approved = Math.min(students, Math.max(10, Math.floor(students * 0.65) + termAdjust[term]));
            const requirementsReview = Math.max(0, students - approved);
            const expiringStudents = Math.min(requirementsReview, Math.max(2, Math.floor(students * 0.2)));
            cohortSeeds.push({
              programId: p.id,
              programName: p.name,
              term,
              year: term === 'Fall' ? ay : ay + 1, // Fall starts AY, others in next calendar year
              students,
              approvedAssignments: approved,
              requirementsReview,
              expiringStudents
            });
          });
        });
      });
      // Explicit archived cohort example (hidden unless "Show archived" is enabled)
      cohortSeeds.push({
        programId: 'adn',
        programName: 'ADN',
        term: 'Fall',
        year: CURRENT_AY_START - 5,
        students: 10,
        approvedAssignments: 7,
        requirementsReview: 3,
        expiringStudents: 2
      });
      // Add a couple of archived cohorts for restore/visibility examples
      cohortSeeds.push({
        programId: 'bsn',
        programName: 'BSN',
        term: 'Fall',
        year: CURRENT_AY_START - 5,
        students: 16,
        approvedAssignments: 11,
        requirementsReview: 5,
        expiringStudents: 3
      });
      cohortSeeds.push({
        programId: 'adn',
        programName: 'ADN',
        term: 'Spring',
        year: CURRENT_AY_START - 4,
        students: 15,
        approvedAssignments: 10,
        requirementsReview: 5,
        expiringStudents: 3
      });

      let cohorts = cohortSeeds.map(buildCohort);

      // Merge in custom cohorts + membership deltas (stored in localStorage via main.js)
      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = cohortAPI ? cohortAPI.getMembershipCounts() : {};
      if (cohortAPI){
        cohorts.forEach(c => {
          const delta = membershipCounts[cohortAPI.seedKeyForLabel(c.label)] || 0;
          if (!delta) return;
          c.students += delta;
          // Assume newly added students start "pending" until reviewed.
          c.requirementsReview += delta;
        });
        const customDash = cohortAPI.listCustomCohortsDashboard({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX });
        customDash.forEach(c => cohorts.push(c));
      }
      // Always include an "Unassigned" cohort option for filtering across pages.
      const unassignedCount = cohortAPI ? cohortAPI.getUnassignedCount() : (membershipCounts.unassigned || 0);
      cohorts.push({
        programId: 'unassigned',
        programName: 'Unassigned',
        term: 'Unassigned',
        startYear: CURRENT_AY_START,
        ayStart: CURRENT_AY_START,
        ayEnd: CURRENT_AY_START + 1,
        ayLabel: `${CURRENT_AY_START}–${CURRENT_AY_START + 1}`,
        label: 'Unassigned',
        archived: false,
        visibleByDefault: true,
        students: unassignedCount,
        approvedAssignments: 0,
        requirementsReview: unassignedCount,
        expiringStudents: 0,
        custom: true
      });

      const currentPrograms = Array.isArray(currentUser?.programs)
        ? currentUser.programs
        : currentUser?.programs ? [currentUser.programs] : [];
      const accessPrograms = (window.CPNW && typeof window.CPNW.getProgramAccessPrograms === 'function')
        ? window.CPNW.getProgramAccessPrograms(currentUser)
        : currentPrograms;
      const accessSummary = (window.CPNW && typeof window.CPNW.getProgramAccessSummary === 'function')
        ? window.CPNW.getProgramAccessSummary(currentUser)
        : { schools: [], programsBySchool: {}, programs: accessPrograms };
      const programAccess = (window.CPNW && typeof window.CPNW.getProgramAccess === 'function')
        ? window.CPNW.getProgramAccess(currentUser)
        : [];
      const programAccessSet = new Set(
        programAccess.map(item => `${normalize(item.school)}|${normalizeProgramToken(item.program)}`)
      );
      const programToSchools = new Map();
      Object.entries(accessSummary.programsBySchool || {}).forEach(([school, programs]) => {
        programs.forEach(program => {
          const key = normalizeProgramLabel(program);
          if (!programToSchools.has(key)) programToSchools.set(key, []);
          const list = programToSchools.get(key);
          if (!list.includes(school)) list.push(school);
        });
      });
      function createSchoolPicker(){
        const programSchoolCursor = new Map();
        return (program) => {
          const key = normalizeProgramLabel(program);
          const schools = programToSchools.get(key);
          if (schools && schools.length){
            const idx = programSchoolCursor.get(key) || 0;
            programSchoolCursor.set(key, idx + 1);
            return schools[idx % schools.length];
          }
          return currentUser?.profile?.school || accessSummary.schools?.[0] || 'CPNW Education';
        };
      }
      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];
      const demoMatch = currentUser?.email
        ? demoPeople.find(p => p.email.toLowerCase() === currentUser.email.toLowerCase())
        : null;
      const fallbackPrograms = Array.isArray(demoMatch?.programs) ? demoMatch.programs : [];
      const programsForScope = accessPrograms.length ? accessPrograms : (currentPrograms.length ? currentPrograms : fallbackPrograms);
      const allowedProgramIds = programsForScope.map(programIdFromName).filter(Boolean);
      if (allowedProgramIds.length){
        cohorts = cohorts.filter(c => {
          if (c.programId === 'unassigned') return true;
          const programKey = c.programId || programIdFromName(c.programName);
          return allowedProgramIds.includes(programKey) || allowedProgramIds.includes(programIdFromName(c.programName));
        });
      }

      function aggregateProgramsFromCohorts(list){
        const map = new Map();
        list.forEach(c => {
          if (c.programId === 'unassigned') return;
          const key = c.programId;
          if (!map.has(key)){
            map.set(key, { id: c.programId, name: c.programName, students: 0, approvedAssignments: 0, requirementsReview: 0, expiringStudents: 0 });
          }
          const entry = map.get(key);
          entry.students += c.students;
          entry.approvedAssignments += c.approvedAssignments;
          entry.requirementsReview += c.requirementsReview;
          entry.expiringStudents += c.expiringStudents;
        });
        return Array.from(map.values());
      }

      function buildReviewCohorts(){
        const reviewPrograms = [
          { id: 'BSN', base: 12, aySpan: 2 },
          { id: 'ADN', base: 10, aySpan: 2 },
          { id: 'Surgical Technology', base: 8, aySpan: 2 },
          { id: 'Radiologic Technology', base: 6, aySpan: 2 },
          { id: 'Respiratory Care', base: 7, aySpan: 2 },
          { id: 'Medical Assistant', base: 6, aySpan: 2 },
          { id: 'Diagnostic Medical Sonography', base: 6, aySpan: 2 }
        ];
        const schoolForProgram = (program) => {
          const token = normalizeProgramToken(program);
          if (token === 'adn' || token === 'surgtech' || token === 'respcare') return 'CPNW University';
          return 'CPNW Education';
        };
        const seeds = [];
        reviewPrograms.forEach(p => {
          const ayStarts = Array.from({length: p.aySpan}, (_, i) => CURRENT_AY_START - i);
          ayStarts.forEach(ay => {
            TERMS.forEach(term => {
              const year = term === 'Fall' ? ay : ay + 1;
              const ayStart = term === 'Fall' ? ay : ay - 1;
              const students = Math.max(8, p.base + termAdjust[term] + (CURRENT_AY_START - ay));
              seeds.push({
                cohortLabel: `${p.id} – ${term} ${year}`,
                program: p.id,
                school: schoolForProgram(p.id),
                students,
                ayStart
              });
            });
          });
        });
        let reviewCohorts = seeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);
        if (cohortAPI){
          const custom = cohortAPI
            .listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX })
            .map(c => ({ ...c, school: schoolForProgram(c.program) }));
          reviewCohorts = reviewCohorts.concat(custom);
        }
        return reviewCohorts;
      }

      const REVIEW_DECISIONS_KEY = 'cpnw-review-decisions-v1';
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

      function loadJSON(key, fallback){
        try{
          const raw = localStorage.getItem(key);
          if (!raw) return fallback;
          return JSON.parse(raw) ?? fallback;
        }catch{
          return fallback;
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

      function decisionToStatus(decision){
        const d = String(decision || '').toLowerCase();
        if (d === 'approve' || d === 'approved') return 'Approved';
        if (d === 'conditional' || d === 'conditionally approved' || d === 'conditionallyapprove' || d === 'conditionally') return 'Conditionally Approved';
        if (d === 'reject' || d === 'rejected') return 'Rejected';
        return '';
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
            if (storedRecord?.meta?.expiration && frequency !== 'Once'
              && (status === 'Approved' || status === 'Conditionally Approved')){
              const expDate = new Date(storedRecord.meta.expiration);
              if (!Number.isNaN(expDate.getTime())) exp = expDate;
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

      function getEducationRequirements(person){
        return buildReqs('complete', seedFromPerson(person), person.sid, person.email)
          .filter(r => r.category !== 'Healthcare' && r.type !== 'eLearning');
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

      function getEducationReviewStatus(person){
        const rows = getEducationRequirements(person);
        const needsReview = rows.some(r => r.status === 'Submitted' || r.status === 'In Review');
        return needsReview ? 'needs-review' : '';
      }

      function isEducationReady(person){
        const rows = getEducationRequirements(person);
        if (!rows.length) return false;
        const allApproved = rows.every(r => r.status === 'Approved' || r.status === 'Conditionally Approved');
        return allApproved && !hasExpiringReq(person);
      }

      function buildReadinessMap(selectedProgramIds = [], selectedCohortLabels = []){
        const cohortSet = new Set(selectedCohortLabels.map(cohortKey));
        const hasCohortSelections = cohortSet.size > 0;
        return reviewPeople.reduce((map, person) => {
          if (programAccessSet.size){
            const key = `${normalize(person.school)}|${normalizeProgramToken(person.program)}`;
            if (!programAccessSet.has(key)) return map;
          }
          if (selectedProgramIds.length){
            const programId = programIdFromName(person.program);
            if (!selectedProgramIds.includes(programId)) return map;
          }
          const cohortLabel = (person.cohort || '').trim() || 'Unassigned';
          const cohortId = cohortKey(cohortLabel);
          if (hasCohortSelections && !cohortSet.has(cohortId)) return map;
          const entry = map.get(cohortId) || { students: 0, ready: 0, pending: 0, expiring: 0 };
          entry.students += 1;
          if (getEducationReviewStatus(person) === 'needs-review') entry.pending += 1;
          if (hasExpiringReq(person)) entry.expiring += 1;
          if (isEducationReady(person)) entry.ready += 1;
          map.set(cohortId, entry);
          return map;
        }, new Map());
      }

      const reviewPeople = (() => {
        const baseRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
          ? window.CPNW.getSharedRoster()
          : [];
        const people = baseRoster
          .filter(person => ['student','faculty','faculty-admin'].includes(person.role))
          .map(person => ({ ...person }));

        return people;
      })();

      function buildActiveStudentRoster(){
        const pickSchoolForProgram = createSchoolPicker();
        const sharedRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
          ? window.CPNW.getSharedRoster()
          : [];
        const list = [];
        sharedRoster.forEach(person => {
          const role = String(person.role || '').toLowerCase();
          if (role !== 'student') return;
          const program = person.program || person.programs?.[0] || '';
          const school = person.school || person.schools?.[0] || pickSchoolForProgram(program);
          let cohortLabel = person.cohort || '';
          if (cohortAPI){
            const override = typeof cohortAPI.getUserCohortLabel === 'function'
              ? cohortAPI.getUserCohortLabel(person.email)
              : null;
            if (override !== null && override !== undefined){
              cohortLabel = override;
            }
          }
          const entry = {
            name: person.name,
            email: person.email,
            program,
            school,
            role: person.role,
            status: 'active',
            cohortLabel
          };
          if (programAccessSet.size){
            const key = `${normalizeSchool(entry.school)}|${normalizeProgramToken(entry.program)}`;
            if (!programAccessSet.has(key)) return;
          }
          list.push(entry);
        });
        return list;
      }

      function buildAssignmentData(){
        const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
        const locations = ['CPNW Medical Center','CPNW Healthcare Facility','Evergreen Health','Providence NW'];
        const statusPool = ['approved','pending','rejected'];
        const pickSchoolForProgram = createSchoolPicker();
        const sharedRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
          ? window.CPNW.getSharedRoster()
          : [];
        const students = [];
        const seedAssignments = [];
        const seenStudents = new Set();
        const fullRosterById = new Map();
        const fullRosterBySid = new Map();
        const fullRosterByEmail = new Map();
        const studentsById = new Map();
        const studentsBySid = new Map();
        const studentsByEmail = new Map();
        const hasAccessFilter = programAccessSet.size > 0;

        function buildRosterEntry(person){
          const program = person.program || person.programs?.[0] || '';
          const rawSchool = person.school || person.schools?.[0] || '';
          const school = rawSchool || pickSchoolForProgram(program);
          const id = String(person.studentId || person.sid || person.email || '').trim();
          const email = String(person.email || '').trim();
          if (!id && !email) return null;
          const entry = {
            id: id || email,
            name: person.name || 'Student',
            sid: String(person.sid || ''),
            email,
            role: person.role || 'student',
            program,
            school,
            cohort: person.cohort || ''
          };
          if (cohortAPI && email){
            const override = typeof cohortAPI.getUserCohortLabel === 'function'
              ? cohortAPI.getUserCohortLabel(email)
              : null;
            if (override !== null && override !== undefined){
              entry.cohort = override;
            }
          }
          return entry;
        }

        function indexRosterEntry(entry){
          if (!entry) return;
          if (entry.id && !fullRosterById.has(entry.id)) fullRosterById.set(entry.id, entry);
          if (entry.sid && !fullRosterBySid.has(entry.sid)) fullRosterBySid.set(entry.sid, entry);
          if (entry.email){
            const key = normalizeEmail(entry.email);
            if (key && !fullRosterByEmail.has(key)) fullRosterByEmail.set(key, entry);
          }
        }

        function indexStudent(entry){
          if (!entry) return;
          if (entry.id) studentsById.set(String(entry.id), entry);
          if (entry.sid) studentsBySid.set(String(entry.sid), entry);
          if (entry.email){
            const key = normalizeEmail(entry.email);
            if (key) studentsByEmail.set(key, entry);
          }
        }

        sharedRoster.forEach(person => {
          const roleKey = String(person?.role || '').trim().toLowerCase();
          if (!['student','faculty','faculty-admin'].includes(roleKey)) return;
          const entry = buildRosterEntry(person);
          if (!entry) return;
          indexRosterEntry(entry);
          if (hasAccessFilter){
            const key = `${normalize(entry.school)}|${normalizeProgramToken(entry.program)}`;
            if (!programAccessSet.has(key)) return;
          }
          const dedupeKey = entry.id || entry.email;
          if (seenStudents.has(dedupeKey)) return;
          seenStudents.add(dedupeKey);
          students.push(entry);
          indexStudent(entry);
        });

        function seedAssignmentsFromStudents(list){
          list.forEach(student => {
            const parts = String(student.id || '').split('-');
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
              seedAssignments.push({
                id: `a-past-${student.id}`,
                studentId: student.id,
                studentSid: student.sid,
                studentEmail: student.email,
                location: locations[(i + idx) % locations.length],
                start: startPast,
                end: endPast,
                status: statusPool[(i + idx + 1) % statusPool.length]
              });
            }

            if (hasCurrentUpcoming){
              const start = new Date(TODAY);
              start.setDate(start.getDate() + (idx * 8) + i * 2);
              const end = new Date(start);
              end.setDate(end.getDate() + 90);
              seedAssignments.push({
                id: `a-cur-${student.id}`,
                studentId: student.id,
                studentSid: student.sid,
                studentEmail: student.email,
                location: locations[(i + idx + 2) % locations.length],
                start,
                end,
                status: statusPool[(i + idx) % statusPool.length]
              });
            }
          });
        }

        function loadJSON(key, fallback){
          try{
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw) ?? fallback;
          }catch{
            return fallback;
          }
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

        if (students.length){
          seedAssignmentsFromStudents(students);
        }

        const stored = loadJSON(ASSIGNMENTS_KEY, null);
        const assignments = Array.isArray(stored) ? hydrateAssignments(stored) || [] : seedAssignments;
        const assignmentNormalizer = window.CPNW && typeof window.CPNW.normalizeAssignments === 'function'
          ? window.CPNW.normalizeAssignments
          : null;
        if (assignmentNormalizer){
          const normalized = assignmentNormalizer(assignments, sharedRoster, { maxCurrent: 1, maxPast: 1 });
          if (normalized && Array.isArray(normalized.list)){
            if (normalized.changed){
              assignments.length = 0;
              assignments.push(...normalized.list);
              try{
                localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(serializeAssignments(assignments)));
              }catch{}
            }else if (normalized.list !== assignments){
              assignments.length = 0;
              assignments.push(...normalized.list);
            }
          }
        }

        function ensureAssignmentRoster(list){
          if (!Array.isArray(list)) return;
          list.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const idKey = String(item.studentId || '').trim();
            const sidKey = String(item.studentSid || '').trim();
            const emailKey = normalizeEmail(item.studentEmail || item.studentEmailAddress || '');
            let match = null;
            if (idKey) match = studentsById.get(idKey);
            if (!match && sidKey) match = studentsBySid.get(sidKey);
            if (!match && emailKey) match = studentsByEmail.get(emailKey);
            if (!match){
              match = fullRosterById.get(idKey)
                || fullRosterBySid.get(sidKey)
                || fullRosterByEmail.get(emailKey);
              if (match){
                const dedupeKey = match.id || match.email;
                if (!seenStudents.has(dedupeKey)){
                  seenStudents.add(dedupeKey);
                  students.push(match);
                  indexStudent(match);
                }
              }
            }
            if (match){
              item.studentId = match.id;
              item.studentSid = match.sid;
              item.studentEmail = match.email;
            }
          });
        }

        ensureAssignmentRoster(assignments);
        return { students, assignments };
      }

      const activeStudentRoster = buildActiveStudentRoster();
      const assignmentData = buildAssignmentData();

      function matchesSelectedCohorts(label, selectedLabels){
        if (!selectedLabels.length) return true;
        const selectedKeys = new Set(selectedLabels.map(cohortKey));
        return selectedKeys.has(cohortKey(label));
      }

      function countActiveStudents(selectedProgramIds = [], selectedCohortLabels = []){
        return activeStudentRoster.filter(student => {
          if (student.status !== 'active' || String(student.role || '').toLowerCase() !== 'student') return false;
          if (selectedProgramIds.length){
            const programId = programIdFromName(student.program);
            if (!selectedProgramIds.includes(programId)) return false;
          }
          if (!matchesSelectedCohorts(student.cohortLabel, selectedCohortLabels)) return false;
          return true;
        }).length;
      }

      function countApprovedAssignments(selectedProgramIds = [], selectedCohortLabels = []){
        const eligibleStudents = new Set();
        assignmentData.students.forEach(student => {
          if (selectedProgramIds.length){
            const programId = programIdFromName(student.program);
            if (!selectedProgramIds.includes(programId)) return;
          }
          if (!matchesSelectedCohorts(student.cohort, selectedCohortLabels)) return;
          eligibleStudents.add(student.id);
        });
        return assignmentData.assignments.filter(assignment => {
          if (!eligibleStudents.has(assignment.studentId)) return false;
          if (assignment.status !== 'approved') return false;
          return assignment?.end instanceof Date && assignment.end >= TODAY;
        }).length;
      }

      function countReviewNeeded(selectedProgramIds = [], selectedCohortLabels = []){
        return reviewPeople.filter(person => {
          if (getEducationReviewStatus(person) !== 'needs-review') return false;
          if (programAccessSet.size){
            const key = `${normalize(person.school)}|${normalizeProgramToken(person.program)}`;
            if (!programAccessSet.has(key)) return false;
          }
          if (selectedProgramIds.length){
            const programId = programIdFromName(person.program);
            if (!selectedProgramIds.includes(programId)) return false;
          }
          if (!matchesSelectedCohorts(person.cohort, selectedCohortLabels)) return false;
          return true;
        }).length;
      }

      function countExpiringStudents(selectedProgramIds = [], selectedCohortLabels = []){
        return reviewPeople.filter(person => {
          if (!hasExpiringReq(person)) return false;
          if (programAccessSet.size){
            const key = `${normalize(person.school)}|${normalizeProgramToken(person.program)}`;
            if (!programAccessSet.has(key)) return false;
          }
          if (selectedProgramIds.length){
            const programId = programIdFromName(person.program);
            if (!selectedProgramIds.includes(programId)) return false;
          }
          if (!matchesSelectedCohorts(person.cohort, selectedCohortLabels)) return false;
          return true;
        }).length;
      }

      function filterCohorts({ search = '', showArchived = false, programIds = [] } = {}){
        const q = search.trim().toLowerCase();
        return cohorts.filter(c => {
          if (programIds.length && c.programId !== 'unassigned' && !programIds.includes(c.programId)) return false;
          const withinWindow = c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX;
          const isArchived = !!c.archived;
          const inView = showArchived ? true : (!isArchived && withinWindow);
          if (!inView) return false;
          if (q){
            return (
              c.label.toLowerCase().includes(q) ||
              c.ayLabel.toLowerCase().includes(q) ||
              c.programName.toLowerCase().includes(q)
            );
          }
          return true;
        });
      }

      let programs = aggregateProgramsFromCohorts(cohorts);

      const filters = document.getElementById('programFilters');
      const programCount = document.getElementById('programCount');
      const programSearch = document.getElementById('programSearch');
      const selectAll = document.getElementById('programSelectAll');
      const clearAll = document.getElementById('programClear');
      const metricApproved = document.getElementById('metricApproved');
      const metricApprovedNote = document.getElementById('metricApprovedNote');
      const metricPending = document.getElementById('metricPending');
      const metricPendingNote = document.getElementById('metricPendingNote');
      const metricActive = document.getElementById('metricActive');
      const metricActiveNote = document.getElementById('metricActiveNote');
      const metricExpiringStudents = document.getElementById('metricExpiringStudents');
      const metricExpiringStudentsNote = document.getElementById('metricExpiringStudentsNote');
      const readinessTableBody = document.getElementById('readinessTableBody');
      const readinessWrapper = document.getElementById('readinessWrapper');
      const readinessToggle = document.getElementById('readinessToggle');
      const cohortFilters = document.getElementById('cohortFilters');
      const cohortCount = document.getElementById('cohortCount');
      const cohortSearch = document.getElementById('cohortSearch');
      const cohortShowArchived = document.getElementById('cohortShowArchived');
      const cohortSelectAll = document.getElementById('cohortSelectAll');
      const cohortClear = document.getElementById('cohortClear');
      const cohortList = document.getElementById('cohortList');
      const createCohortBtn = document.getElementById('createCohortBtn');
      const createCohortModalEl = document.getElementById('createCohortModal');
      const createCohortProgram = document.getElementById('createCohortProgram');
      const createCohortName = document.getElementById('createCohortName');
      const createCohortRemaining = document.getElementById('createCohortRemaining');
      const createCohortCollision = document.getElementById('createCohortCollision');
      const createCohortConfirm = document.getElementById('createCohortConfirm');

      if (!filters) return;

      const createCohortModal = (window.bootstrap && createCohortModalEl)
        ? new bootstrap.Modal(createCohortModalEl)
        : null;

      function setCreateCollision(message){
        if (!createCohortCollision) return;
        if (!message){
          createCohortCollision.classList.add('d-none');
          createCohortCollision.textContent = '';
          return;
        }
        createCohortCollision.classList.remove('d-none');
        createCohortCollision.textContent = message;
      }

      function setCreateRemaining(){
        if (!createCohortName || !createCohortRemaining) return;
        const max = 75;
        createCohortRemaining.textContent = String(Math.max(0, max - (createCohortName.value || '').length));
      }

      function programNameForId(programId){
        const entry = programs.find(p => p.id === programId);
        return entry ? entry.name : (programId || '').toUpperCase();
      }

      function validateCreate(){
        if (!createCohortConfirm || !createCohortProgram || !createCohortName){
          return false;
        }
        const programId = createCohortProgram.value || '';
        const programName = programNameForId(programId);
        const name = (createCohortName.value || '').trim();
        if (!programId || !name){
          setCreateCollision('');
          createCohortConfirm.disabled = true;
          return false;
        }
        const fullLabel = `${programName} – ${name}`;
        const existsInList = cohorts.some(c => (c.label || '').toLowerCase() === fullLabel.toLowerCase());
        const customCollision = cohortAPI?.findCustomCohortCollision(programName, name);
        if (existsInList || customCollision){
          setCreateCollision(`A cohort named "${fullLabel}" already exists. Please choose a unique name.`);
          createCohortConfirm.disabled = true;
          return false;
        }
        setCreateCollision('');
        createCohortConfirm.disabled = false;
        return true;
      }

      function refreshPrograms(){
        programs = aggregateProgramsFromCohorts(cohorts);
      }

      function openCreateCohort(){
        if (!createCohortModal) return;
        setCreateCollision('');
        if (createCohortName) createCohortName.value = '';
        setCreateRemaining();
        if (createCohortProgram){
          createCohortProgram.innerHTML = [
            '<option value="">Select program</option>',
            ...programs
              .filter(p => p.id !== 'unassigned')
              .map(p => `<option value="${p.id}">${p.name}</option>`)
          ].join('');
          createCohortProgram.value = '';
        }
        validateCreate();
        createCohortModal.show();
      }

      function renderFilters(filterText = ''){
        filters.innerHTML = '';
        const text = filterText.trim().toLowerCase();
        programs
          .filter(p => !text || p.name.toLowerCase().includes(text))
          .forEach(p => {
            const id = `program-${p.id}`;
            const label = document.createElement('label');
            label.className = 'd-flex align-items-center gap-2 form-check-label';
            label.htmlFor = id;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.id = id;
            input.value = p.id;
            input.checked = true;

            const textSpan = document.createElement('span');
            textSpan.textContent = `${p.name} (${p.students})`;

            label.appendChild(input);
            label.appendChild(textSpan);
            filters.appendChild(label);
          });
      }

      function getSelectedPrograms(){
        const selectedIds = Array.from(filters.querySelectorAll('input:checked')).map(i => i.value);
        return programs.filter(p => selectedIds.includes(p.id));
      }

      function getSelectedCohortLabels(){
        if (!cohortFilters) return [];
        return Array.from(cohortFilters.querySelectorAll('input:checked')).map(i => i.value);
      }

      function renderCohortFilters(filterText = '', showArchived = false, programIds = [], preserveSelection = true){
        if (!cohortFilters) return;
        const existingSelection = preserveSelection ? new Set(getSelectedCohortLabels()) : new Set();
        cohortFilters.innerHTML = '';
        const list = filterCohorts({ search: filterText, showArchived, programIds });
        list.forEach(c => {
          const id = `cohort-${c.label.replace(/\s+/g, '-').toLowerCase()}`;
          const label = document.createElement('label');
          label.className = 'd-flex align-items-center gap-2 form-check-label';
          label.htmlFor = id;

          const input = document.createElement('input');
          input.type = 'checkbox';
          input.className = 'form-check-input';
          input.id = id;
          input.value = c.label;
          input.checked = preserveSelection ? existingSelection.has(c.label) || existingSelection.size === 0 : true;

          const textSpan = document.createElement('span');
          textSpan.textContent = c.programId === 'unassigned'
            ? 'Unassigned • No cohort assigned'
            : `${c.label} • AY ${c.ayLabel}`;

          label.appendChild(input);
          label.appendChild(textSpan);
          cohortFilters.appendChild(label);
        });
      }

      let cohortSelectionMode = 'auto'; // 'auto' follows program filters, 'manual' respects explicit cohort picks

      function getSelectedCohorts(){
        if (!cohortFilters) return [];
        const selectedLabels = Array.from(cohortFilters.querySelectorAll('input:checked')).map(i => i.value);
        return cohorts.filter(c => selectedLabels.includes(c.label));
      }

      function summarize(){
        const selectedPrograms = getSelectedPrograms();
        const selectedProgramIds = selectedPrograms.map(p => p.id);
        const selectedCohortLabels = getSelectedCohortLabels();
        const cohortFilterLabels = cohortSelectionMode === 'manual' ? selectedCohortLabels : [];
        const totalPrograms = selectedPrograms.length || programs.length;
        const currentSearch = cohortSearch ? cohortSearch.value : '';
        const showArchived = cohortShowArchived ? cohortShowArchived.checked : false;
        const visibleCohorts = filterCohorts({ search: currentSearch, showArchived, programIds: selectedProgramIds });
        const activeCohorts = visibleCohorts.filter(c => !c.archived);
        const selectedCohorts = getSelectedCohorts()
          .filter(c => !c.archived)
          .filter(c => !selectedProgramIds.length || c.programId === 'unassigned' || selectedProgramIds.includes(c.programId));
        const cohortsForTotals = selectedCohorts.length ? selectedCohorts : activeCohorts;
        const cohortCountSelected = cohortsForTotals.length;
        if (programCount){
          programCount.textContent = totalPrograms === programs.length ? 'All' : totalPrograms || '0';
        }
        const totals = cohortsForTotals.reduce((acc, c) => {
          acc.students += c.students;
          acc.approved += c.approvedAssignments;
          acc.pending += c.requirementsReview;
          acc.expiringStudents += c.expiringStudents;
          return acc;
        }, {students:0, approved:0, pending:0, expiringStudents:0});
        const reviewNeeded = countReviewNeeded(selectedProgramIds, cohortFilterLabels);
        const activeStudents = countActiveStudents(selectedProgramIds, cohortFilterLabels);
        const approvedAssignments = countApprovedAssignments(selectedProgramIds, cohortFilterLabels);
        const expiringStudents = countExpiringStudents(selectedProgramIds, cohortFilterLabels);

        metricApproved.textContent = approvedAssignments;
        metricApprovedNote.textContent = '';

        metricPending.textContent = reviewNeeded;
        metricPendingNote.textContent = '';

        metricActive.textContent = activeStudents;
        metricActiveNote.textContent = '';

        metricExpiringStudents.textContent = expiringStudents;
        metricExpiringStudentsNote.textContent = '';

        if (cohortCount){
          cohortCount.textContent = selectedCohorts.length ? cohortCountSelected : activeCohorts.length || 'All';
        }

        const listForCard = showArchived ? visibleCohorts : cohortsForTotals;
        const readinessMap = buildReadinessMap(selectedProgramIds, selectedCohortLabels);
        renderCohorts(listForCard);
        renderReadiness(cohortsForTotals, readinessMap);
      }

      function renderCohorts(items){
        if (!cohortList) return;
        cohortList.innerHTML = '';
        const list = items || filterCohorts({
          search: cohortSearch ? cohortSearch.value : '',
          showArchived: cohortShowArchived ? cohortShowArchived.checked : false,
          programIds: getSelectedPrograms().map(p => p.id)
        });
        if (!list.length){
          const li = document.createElement('li');
          li.className = 'text-body-secondary small';
          li.textContent = 'No cohorts match your filters.';
          cohortList.appendChild(li);
          return;
        }
        list.forEach(c => {
          const li = document.createElement('li');
          li.className = 'cpnw-shell p-2 d-flex justify-content-between align-items-center';
          const left = document.createElement('div');
          left.innerHTML = c.programId === 'unassigned'
            ? `<div class="fw-semibold">Unassigned</div><div class="small text-body-secondary">No cohort assigned</div>`
            : `<div class="fw-semibold">${c.label}</div><div class="small text-body-secondary">AY ${c.ayLabel}</div>`;
          const actions = document.createElement('div');
          actions.className = 'd-flex align-items-center gap-2';
          const badge = document.createElement('span');
          badge.className = `badge ${c.archived ? 'text-bg-secondary' : 'text-bg-success'}`;
          badge.textContent = c.archived ? 'Archived' : 'Active';
          actions.appendChild(badge);
          if (c.programId !== 'unassigned'){
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'btn btn-outline-light btn-sm';
            toggleBtn.textContent = c.archived ? 'Restore' : 'Archive';
            toggleBtn.dataset.cohortAction = c.archived ? 'restore' : 'archive';
            toggleBtn.dataset.cohortLabel = c.label;
            actions.appendChild(toggleBtn);
          }
          li.appendChild(left);
          li.appendChild(actions);
          cohortList.appendChild(li);
        });
      }

      function renderReadiness(list, readinessMap){
        if (!readinessTableBody) return;
        readinessTableBody.innerHTML = '';
        const rows = (list || []).map(c => {
          const stats = readinessMap?.get(cohortKey(c.label)) || { students: 0, ready: 0, pending: 0, expiring: 0 };
          return `
            <tr>
              <td class="fw-semibold">${c.label}</td>
              <td>${stats.students}</td>
              <td><span class="text-success fw-semibold">${stats.ready}</span></td>
              <td>${stats.pending}</td>
              <td>${stats.expiring}</td>
            </tr>
          `;
        }).join('');
        readinessTableBody.innerHTML = rows || '<tr><td colspan="5" class="text-body-secondary small">No cohorts match your filters.</td></tr>';
      }

      renderFilters();
      renderCohortFilters('', cohortShowArchived && cohortShowArchived.checked, [], true);
      summarize();

      function handleProgramSelectionChanged(){
        const selectedIds = getSelectedPrograms().map(p => p.id);
        const showArchived = cohortShowArchived && cohortShowArchived.checked;
        const preserve = cohortSelectionMode === 'manual';
        renderCohortFilters(cohortSearch ? cohortSearch.value : '', showArchived, selectedIds, preserve);
        if (!preserve && cohortFilters){
          cohortFilters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
        }
        summarize();
      }

      filters.addEventListener('change', handleProgramSelectionChanged);
      filters.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      if (programSearch){
        programSearch.addEventListener('input', (e) => {
          renderFilters(e.target.value || '');
          handleProgramSelectionChanged();
        });
      }
      if (selectAll){
        selectAll.addEventListener('click', () => {
          filters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
          handleProgramSelectionChanged();
        });
      }
      if (clearAll){
        clearAll.addEventListener('click', () => {
          filters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
          handleProgramSelectionChanged();
        });
      }

      if (cohortSearch){
        cohortSearch.addEventListener('input', (e) => {
          cohortSelectionMode = 'manual';
          const selectedIds = getSelectedPrograms().map(p => p.id);
          const term = (e.target.value || '').trim();
          const showArchived = cohortShowArchived && cohortShowArchived.checked;
          if (!term){
            if (cohortShowArchived) cohortShowArchived.checked = false;
            renderCohortFilters('', false, selectedIds, false); // reset selection
          }else{
            renderCohortFilters(term, showArchived, selectedIds, true);
          }
          summarize();
        });
      }
      if (cohortShowArchived){
        cohortShowArchived.addEventListener('change', (e) => {
          cohortSelectionMode = 'manual';
          const selectedIds = getSelectedPrograms().map(p => p.id);
          renderCohortFilters(cohortSearch ? cohortSearch.value : '', e.target.checked, selectedIds, false);
          summarize();
        });
      }
      if (cohortSelectAll){
        cohortSelectAll.addEventListener('click', () => {
          cohortSelectionMode = 'manual';
          cohortFilters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
          summarize();
        });
      }
      if (cohortClear){
        cohortClear.addEventListener('click', () => {
          cohortSelectionMode = 'manual';
          cohortFilters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
          summarize();
        });
      }
      if (cohortFilters){
        cohortFilters.addEventListener('change', () => {
          cohortSelectionMode = 'manual';
          summarize();
        });
        cohortFilters.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      if (cohortList){
        cohortList.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-cohort-action]');
          if (!btn) return;
          const label = btn.dataset.cohortLabel;
          const action = btn.dataset.cohortAction;
          const cohort = cohorts.find(c => c.label === label);
          if (!cohort) return;
          if (cohort.programId === 'unassigned') return;
          const confirmMsg = action === 'archive'
            ? `Archive cohort "${label}"? It will be hidden from active views unless you show archived.`
            : `Restore cohort "${label}" to active views?`;
          if (!window.confirm(confirmMsg)) return;
          cohort.archived = action === 'archive';
          // Re-render filters/list/metrics to reflect change
          const selectedIds = getSelectedPrograms().map(p => p.id);
          renderCohortFilters(cohortSearch ? cohortSearch.value : '', cohortShowArchived && cohortShowArchived.checked, selectedIds, true);
          summarize();
        });
      }

      if (readinessToggle && readinessWrapper){
        readinessToggle.addEventListener('click', () => {
          const expanded = readinessWrapper.dataset.expanded === 'true';
          readinessWrapper.dataset.expanded = (!expanded).toString();
          readinessWrapper.style.maxHeight = expanded ? '260px' : '520px';
          readinessToggle.textContent = expanded ? 'View all' : 'Collapse';
        });
      }

      if (createCohortBtn){
        createCohortBtn.addEventListener('click', openCreateCohort);
      }
      createCohortName?.addEventListener('input', () => {
        setCreateRemaining();
        validateCreate();
      });
      createCohortProgram?.addEventListener('change', validateCreate);
      createCohortModalEl?.addEventListener('shown.bs.modal', () => {
        createCohortName?.focus();
      });
      createCohortConfirm?.addEventListener('click', () => {
        if (!validateCreate()) return;
        if (!cohortAPI) return;
        const programId = createCohortProgram.value || '';
        const programName = programNameForId(programId);
        const name = (createCohortName.value || '').trim();
        const record = cohortAPI.addCustomCohort({ name, program: programName, ayStart: CURRENT_AY_START });
        if (!record){
          setCreateCollision('Unable to create cohort. Please choose a different name.');
          return;
        }
        const ayStart = record.ayStart;
        const ayEnd = ayStart + 1;
        cohorts.push({
          programId,
          programName: record.program,
          term: 'Custom',
          startYear: ayStart,
          ayStart,
          ayEnd,
          ayLabel: `${ayStart}–${ayEnd}`,
          label: `${record.program} – ${record.name}`,
          archived: false,
          visibleByDefault: true,
          students: 0,
          approvedAssignments: 0,
          requirementsReview: 0,
          expiringStudents: 0,
          custom: true,
          cohortId: record.id
        });
        refreshPrograms();
        renderFilters(programSearch ? programSearch.value : '');
        const selectedIds = getSelectedPrograms().map(p => p.id);
        renderCohortFilters(cohortSearch ? cohortSearch.value : '', cohortShowArchived && cohortShowArchived.checked, selectedIds, true);
        summarize();
        createCohortModal.hide();
      });

      renderCohorts();
    })();
  
