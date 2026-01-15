
    (function(){
      const programs = [
        { id:'bsn', name:'BSN' },
        { id:'adn', name:'ADN' },
        { id:'surg', name:'Surg Tech' },
        { id:'rad', name:'Radiologic Technology' },
        { id:'resp', name:'Respiratory Care' },
        { id:'med', name:'Medical Assistant' },
        { id:'sono', name:'Diagnostic Medical Sonography' },
        { id:'allied', name:'Allied Health' }
      ];
      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
      const ASSIGNMENT_GRACE_DAYS = 14;
      const ASSIGNMENT_WINDOW_DAYS = 42;
      const REVIEW_DECISIONS_KEY = 'cpnw-review-decisions-v1';
      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
      const HEALTHCARE_REVIEWABLE_STATUSES = new Set(['Submitted', 'In Review']);
      const HEALTHCARE_EXPIRING_STATUSES = new Set(['Expired', 'Expiring', 'Expiring Soon']);
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

      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];
      const termAdjust = { Fall:3, Winter:1, Spring:0, Summer:-2 };

      const programDefs = [
        { id:'BSN', base: 12, aySpan: 2 },
        { id:'ADN', base: 10, aySpan: 2 },
        { id:'Surg Tech', base: 8, aySpan: 2 },
        { id:'Radiologic Technology', base: 6, aySpan: 2 },
        { id:'Respiratory Care', base: 7, aySpan: 2 },
        { id:'Medical Assistant', base: 6, aySpan: 2 },
        { id:'Diagnostic Medical Sonography', base: 6, aySpan: 2 }
      ];
      const programIdMap = {
        'BSN':'bsn',
        'ADN':'adn',
        'Surg Tech':'surg',
        'Radiologic Technology':'rad',
        'Respiratory Care':'resp',
        'Medical Assistant':'med',
        'Diagnostic Medical Sonography':'sono',
        'Allied Health':'allied'
      };

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

      function normalize(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeProgramToken(value){
        const name = normalize(value).replace(/[^a-z0-9]/g, '');
        if (name.includes('surg')) return 'surgtech';
        if (name.includes('rad')) return 'radtech';
        if (name.includes('resp')) return 'respcare';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'medicalassistant';
        if (name.includes('allied')) return 'alliedhealth';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function normalizeEmail(value){
        return String(value || '').trim().toLowerCase();
      }

      function toDateInputValue(date){
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      function parseDateInput(value){
        if (!value) return null;
        const parts = String(value).split('-').map(Number);
        if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;
        const [year, month, day] = parts;
        return new Date(year, month - 1, day);
      }

      function dateAtMidnight(date){
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }

      function formatShortDate(date){
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
        try{
          localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(serializeAssignments(list)));
        }catch{
          // ignore
        }
      }

      function getHealthcareFacilityNames(){
        const currentUser = window.CPNW && typeof window.CPNW.getCurrentUser === 'function'
          ? window.CPNW.getCurrentUser()
          : (window.CPNW?.currentUser || null);
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
        const locations = ['CPNW Medical Center','CPNW Healthcare Facility','Evergreen Health','Providence NW'];
        const statusPool = ['approved','pending','rejected'];
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
            assignments.push({
              id: `a-cur-${person.studentId}`,
              studentId: person.studentId,
              studentSid: person.sid,
              location: locations[(i + idx + 2) % locations.length],
              start,
              end,
              status: statusPool[(i + idx) % statusPool.length]
            });
          }
        });
        return assignments;
      }

      function seedFromPerson(person){
        const key = person?.sid || person?.email || person?.name || '';
        return Array.from(String(key)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      }

      function buildHealthcareReqs(person){
        const rows = [];
        const seedOffset = seedFromPerson(person);
        const overallStatus = person.status === 'needs-review' ? 'needs-review' : 'complete';
        const studentContext = { sid: person.sid, email: person.email };
        const studentKey = requirementsStore ? requirementsStore.resolveStudentKey(studentContext) : '';
        for (let i = 1; i <= 6; i += 1){
          const name = `Healthcare Req ${i}`;
          let status = reqStatusPool[(i + (overallStatus === 'needs-review' ? 1 : 3) + 2 + (seedOffset % reqStatusPool.length)) % reqStatusPool.length];
          let storedRecord = null;
          if (requirementsStore && studentKey){
            storedRecord = requirementsStore.getRecord(studentKey, name);
            if (storedRecord?.status){
              status = storedRecord.status;
            }else{
              status = requirementsStore.getStatus(studentContext, name, { category: 'Healthcare' });
            }
          }
          const saved = getDecisionRecord(person.sid, name);
          const savedStatus = decisionToStatus(saved?.decision);
          if (savedStatus && (!storedRecord || storedRecord.source === 'seed')){
            status = savedStatus;
            requirementsStore?.setStatus(studentContext, name, savedStatus, {
              source: 'decision',
              updatedAt: saved?.savedAt || saved?.at || new Date().toISOString()
            });
          }
          rows.push({ name, status });
        }
        return rows;
      }

      function hasHealthcareReviewItems(person){
        return buildHealthcareReqs(person).some(r => HEALTHCARE_REVIEWABLE_STATUSES.has(r.status));
      }

      function getHealthcareReadinessSummary(person){
        const rows = buildHealthcareReqs(person);
        const hasReviewable = rows.some(r => HEALTHCARE_REVIEWABLE_STATUSES.has(r.status));
        const hasExpiring = rows.some(r => HEALTHCARE_EXPIRING_STATUSES.has(r.status));
        const ready = rows.length > 0
          && rows.every(r => r.status === 'Approved' || r.status === 'Conditionally Approved')
          && !hasExpiring;
        return { hasReviewable, hasExpiring, ready };
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

      function assignmentWithinRosterWindow(assignment){
        const start = assignment?.start instanceof Date ? assignment.start : (assignment?.start ? new Date(assignment.start) : null);
        const end = assignment?.end instanceof Date ? assignment.end : (assignment?.end ? new Date(assignment.end) : null);
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
        if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;
        const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const upcomingLimit = new Date(today);
        upcomingLimit.setDate(upcomingLimit.getDate() + ASSIGNMENT_WINDOW_DAYS);
        const endLimit = new Date(endDay);
        endLimit.setDate(endLimit.getDate() + ASSIGNMENT_GRACE_DAYS);
        const startsSoon = startDay >= today && startDay <= upcomingLimit;
        const activeOrRecent = startDay <= today && endLimit >= today;
        return startsSoon || activeOrRecent;
      }

      function assignmentMatchesFacility(assignment, facilityNames){
        if (!facilityNames.size) return false;
        const loc = normalize(assignment?.location);
        return facilityNames.has(loc);
      }

      function buildAssignmentEligibility(assignments, facilityNames){
        const ids = new Set();
        const sids = new Set();
        const emails = new Set();
        assignments.forEach(assignment => {
          if (!assignmentMatchesFacility(assignment, facilityNames)) return;
          if (!assignmentWithinWindow(assignment)) return;
          if (assignment.studentId) ids.add(String(assignment.studentId));
          if (assignment.studentSid) sids.add(String(assignment.studentSid));
          if (assignment.studentEmail) emails.add(normalizeEmail(assignment.studentEmail));
        });
        return { ids, sids, emails };
      }

      function buildReadinessRoster(people, eligibility){
        if (!eligibility) return [];
        return (people || []).filter(person => {
          if (String(person.role || '').toLowerCase() !== 'student') return false;
          const idMatch = person.studentId && eligibility.ids.has(String(person.studentId));
          const sidMatch = person.sid && eligibility.sids.has(String(person.sid));
          const emailMatch = person.email && eligibility.emails.has(normalizeEmail(person.email));
          return idMatch || sidMatch || emailMatch;
        });
      }

      function buildReviewPeople(){
        const baseRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
          ? window.CPNW.getSharedRoster()
          : [];
        const people = baseRoster
          .filter(person => ['student','faculty','faculty-admin'].includes(person.role))
          .map(person => ({ ...person }));
        return people;
      }

      const filters = document.getElementById('programFilters');
      const programCount = document.getElementById('programCount');
      const programSearch = document.getElementById('programSearch');
      const selectAllBtn = document.getElementById('programSelectAll');
      const clearBtn = document.getElementById('programClear');
      const notificationsList = document.getElementById('healthcareNotifications');
      const summaryStartInput = document.getElementById('summaryStart');
      const summaryEndInput = document.getElementById('summaryEnd');
      const summaryTotalEl = document.getElementById('summaryTotal');
      const summaryApprovedEl = document.getElementById('summaryApproved');
      const summaryPendingEl = document.getElementById('summaryPending');
      const summaryRejectedEl = document.getElementById('summaryRejected');
      const summaryNote = document.getElementById('summaryNote');

      const metricPending = document.getElementById('metricPending');
      const metricPendingNote = document.getElementById('metricPendingNote');
      const metricApproved = document.getElementById('metricApproved');
      const metricApprovedNote = document.getElementById('metricApprovedNote');
      const metricRejected = document.getElementById('metricRejected');
      const metricRejectedNote = document.getElementById('metricRejectedNote');
      const metricExpiring = document.getElementById('metricExpiring');
      const metricExpiringNote = document.getElementById('metricExpiringNote');
      const readinessTableBody = document.getElementById('hcReadinessTableBody');
      const readinessWrapper = document.getElementById('hcReadinessWrapper');
      const readinessToggle = document.getElementById('hcReadinessToggle');
      const readinessSchoolInput = document.getElementById('hcReadinessSchoolFilter');
      const readinessProgramInput = document.getElementById('hcReadinessProgramFilter');
      const readinessSchoolMenu = readinessSchoolInput?.closest('[data-multi-filter]')?.querySelector('[data-readiness-school-menu]');
      const readinessProgramMenu = readinessProgramInput?.closest('[data-multi-filter]')?.querySelector('[data-readiness-program-menu]');
      const buildMultiSelect = (window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
        ? window.CPNW.buildCheckboxMultiSelect
        : null;

      if (!filters) return;

      const reviewPeople = buildReviewPeople();
      const storedAssignments = loadAssignments();
      const assignments = storedAssignments || seedAssignmentsFromPeople(reviewPeople);
      const assignmentNormalizer = window.CPNW && typeof window.CPNW.normalizeAssignments === 'function'
        ? window.CPNW.normalizeAssignments
        : null;
      if (assignmentNormalizer){
        const normalized = assignmentNormalizer(assignments, reviewPeople, { maxCurrent: 1, maxPast: 1 });
        if (normalized && Array.isArray(normalized.list)){
          if (normalized.changed){
            assignments.length = 0;
            assignments.push(...normalized.list);
            saveAssignments(assignments);
          }else if (normalized.list !== assignments){
            assignments.length = 0;
            assignments.push(...normalized.list);
          }
        }
      }else if (!storedAssignments){
        saveAssignments(assignments);
      }
      const facilityNames = getHealthcareFacilityNames();
      const assignmentEligibility = buildAssignmentEligibility(assignments, facilityNames);
      const readinessRoster = buildReadinessRoster(reviewPeople, assignmentEligibility);
      const readinessSchoolProgramMap = buildReadinessSchoolProgramMap(readinessRoster);
      let readinessSchoolControl = null;
      let readinessProgramControl = null;

      function buildReadinessSchoolProgramMap(people){
        const map = new Map();
        (people || []).forEach(person => {
          const school = person.school || '';
          const program = person.program || '';
          if (!school || !program) return;
          if (!map.has(school)) map.set(school, new Set());
          map.get(school).add(program);
        });
        return map;
      }

      function buildReadinessSchoolItems(){
        return Array.from(readinessSchoolProgramMap.keys())
          .sort((a,b) => a.localeCompare(b))
          .map(school => ({ value: school, label: school }));
      }

      function buildReadinessProgramItems(selectedSchools = []){
        const schools = selectedSchools.length
          ? selectedSchools
          : Array.from(readinessSchoolProgramMap.keys()).sort((a,b) => a.localeCompare(b));
        const items = [];
        schools.forEach((school) => {
          const programs = Array.from(readinessSchoolProgramMap.get(school) || [])
            .sort((a,b) => a.localeCompare(b));
          programs.forEach((program) => {
            items.push({
              value: `${school}||${program}`,
              label: program,
              group: school
            });
          });
        });
        return items;
      }

      function getReadinessSelections(){
        return {
          schools: readinessSchoolControl ? readinessSchoolControl.getSelection() : [],
          programs: readinessProgramControl ? readinessProgramControl.getSelection() : []
        };
      }

      function renderReadinessTable(){
        if (!readinessTableBody) return;
        const { schools, programs } = getReadinessSelections();
        const hasSchoolFilter = schools.length > 0;
        const hasProgramFilter = programs.length > 0;
        const readinessMap = new Map();
        readinessRoster.forEach(person => {
          if (hasSchoolFilter && !schools.includes(person.school)) return;
          if (hasProgramFilter){
            const programKey = `${person.school}||${person.program}`;
            if (!programs.includes(programKey)) return;
          }
          const cohortLabel = (person.cohort || '').trim() || 'Unassigned';
          const entry = readinessMap.get(cohortLabel) || { label: cohortLabel, students: 0, ready: 0, pending: 0, expiring: 0 };
          const summary = getHealthcareReadinessSummary(person);
          entry.students += 1;
          if (summary.ready) entry.ready += 1;
          if (summary.hasReviewable) entry.pending += 1;
          if (summary.hasExpiring) entry.expiring += 1;
          readinessMap.set(cohortLabel, entry);
        });
        const rows = Array.from(readinessMap.values())
          .sort((a,b) => {
            if (b.pending !== a.pending) return b.pending - a.pending;
            if (b.students !== a.students) return b.students - a.students;
            return a.label.localeCompare(b.label);
          })
          .map(item => `
            <tr>
              <td class="fw-semibold">${item.label}</td>
              <td>${item.students}</td>
              <td><span class="text-success fw-semibold">${item.ready}</span></td>
              <td>${item.pending}</td>
              <td>${item.expiring}</td>
            </tr>
          `)
          .join('');
        readinessTableBody.innerHTML = rows || '<tr><td colspan="5" class="text-body-secondary small">No cohorts match your filters.</td></tr>';
      }

      function refreshReadinessPrograms(){
        if (!readinessProgramControl) return;
        const { schools } = getReadinessSelections();
        readinessProgramControl.setItems(buildReadinessProgramItems(schools));
      }

      function initReadinessFilters(){
        if (!buildMultiSelect) return;
        if (readinessSchoolInput && readinessSchoolMenu){
          readinessSchoolControl = buildMultiSelect({
            input: readinessSchoolInput,
            menu: readinessSchoolMenu,
            items: buildReadinessSchoolItems(),
            placeholder: 'All schools',
            onChange: () => {
              refreshReadinessPrograms();
              renderReadinessTable();
            }
          });
        }
        if (readinessProgramInput && readinessProgramMenu){
          readinessProgramControl = buildMultiSelect({
            input: readinessProgramInput,
            menu: readinessProgramMenu,
            items: buildReadinessProgramItems([]),
            placeholder: 'All programs',
            onChange: () => {
              renderReadinessTable();
            }
          });
        }
        refreshReadinessPrograms();
      }

      if (summaryStartInput && !summaryStartInput.value){
        summaryStartInput.value = toDateInputValue(TODAY);
      }
      if (summaryEndInput && !summaryEndInput.value){
        const defaultEnd = new Date(TODAY);
        defaultEnd.setDate(defaultEnd.getDate() + 7);
        summaryEndInput.value = toDateInputValue(defaultEnd);
      }

      function programIdForPerson(person){
        const direct = programIdMap[person?.program] || '';
        if (direct) return direct;
        const token = normalizeProgramToken(person?.program);
        if (!token) return '';
        const tokenMap = {
          bsn: 'bsn',
          adn: 'adn',
          surgtech: 'surg',
          radtech: 'rad',
          respcare: 'resp',
          medicalassistant: 'med',
          sonography: 'sono',
          dms: 'sono',
          alliedhealth: 'allied'
        };
        return tokenMap[token] || '';
      }

      function findPersonForAssignment(assignment){
        if (!assignment) return null;
        const id = String(assignment.studentId || '');
        const sid = String(assignment.studentSid || '');
        return reviewPeople.find(person => {
          if (id && String(person.studentId || '') === id) return true;
          if (sid && String(person.sid || '') === sid) return true;
          return false;
        }) || null;
      }

      function renderProgramFilters(term = ''){
        const existing = new Set(Array.from(filters.querySelectorAll('input:checked')).map(i => i.value));
        const hadSelection = existing.size > 0;
        filters.innerHTML = '';
        const q = String(term || '').trim().toLowerCase();
        programs
          .filter(p => !q || p.name.toLowerCase().includes(q))
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
            input.checked = hadSelection ? existing.has(p.id) : true;
            const textSpan = document.createElement('span');
            textSpan.textContent = p.name;
            label.appendChild(input);
            label.appendChild(textSpan);
            filters.appendChild(label);
          });
      }

      function getSelectedProgramIds(){
        return Array.from(filters.querySelectorAll('input:checked')).map(i => i.value);
      }

      function getSummaryRange(){
        const start = dateAtMidnight(parseDateInput(summaryStartInput?.value));
        const end = dateAtMidnight(parseDateInput(summaryEndInput?.value));
        if (start && end && end < start) return { start, end: start };
        return { start, end };
      }

      function assignmentStartsWithinRange(assignment, range){
        if (!range.start || !range.end) return true;
        const start = assignment?.start instanceof Date ? assignment.start : (assignment?.start ? new Date(assignment.start) : null);
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
        const startDay = dateAtMidnight(start);
        return startDay >= range.start && startDay <= range.end;
      }

      function isStatusApproved(status){
        return String(status || '').toLowerCase() === 'approved';
      }

      function isStatusRejected(status){
        return String(status || '').toLowerCase() === 'rejected';
      }

      function isStatusPending(status){
        const s = String(status || '').toLowerCase();
        return s === 'pending' || s === 'reviewing' || s === '';
      }

      function buildNotificationList(items){
        if (!notificationsList) return;
        if (!items.length){
          notificationsList.innerHTML = `
            <li class="d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">All caught up</div>
                <p class="small text-body-secondary mb-0">No new alerts at the moment.</p>
              </div>
              <span class="badge text-bg-success">Clear</span>
            </li>
          `;
          return;
        }
        notificationsList.innerHTML = items.map(item => `
          <li class="d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-semibold">${item.title}</div>
              ${item.meta ? `<p class="small text-body-secondary mb-1">${item.meta}</p>` : ''}
              ${item.action ? `<a href="${item.action.href}" class="small text-decoration-none">${item.action.label}</a>` : ''}
            </div>
            <span class="badge ${item.badgeClass}">${item.badgeLabel}</span>
          </li>
        `).join('');
      }

      function getUpcomingPendingCount(list){
        const today = dateAtMidnight(TODAY);
        const upcomingLimit = new Date(today);
        upcomingLimit.setDate(upcomingLimit.getDate() + 7);
        return list.filter(assignment => {
          const start = assignment?.start instanceof Date ? assignment.start : (assignment?.start ? new Date(assignment.start) : null);
          if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
          const startDay = dateAtMidnight(start);
          return startDay >= today && startDay <= upcomingLimit && isStatusPending(assignment.status);
        }).length;
      }

	      function summarize(){
	        const selectedIds = getSelectedProgramIds();
	        const effective = selectedIds.length ? selectedIds : programs.map(p => p.id);
	        if (programCount){
	          programCount.textContent = effective.length === programs.length ? 'All' : String(effective.length);
	        }

	        const submittedReviewStudentCount = reviewPeople
	          .filter(p => (p.studentId && assignmentEligibility.ids.has(p.studentId))
	            || assignmentEligibility.sids.has(p.sid)
	            || (p.email && assignmentEligibility.emails.has(normalizeEmail(p.email))))
	          .filter(p => effective.includes(programIdForPerson(p)))
	          .filter(p => hasHealthcareReviewItems(p))
	          .length;

          const isFiltered = effective.length !== programs.length;
          const scopedAssignments = assignments
            .filter(a => assignmentMatchesFacility(a, facilityNames))
            .filter(assignmentWithinRosterWindow)
            .filter(a => {
              const person = findPersonForAssignment(a);
              const programId = programIdForPerson(person);
              if (!programId) return !isFiltered;
              return effective.includes(programId);
            });
        const approvedAssignments = scopedAssignments.filter(a => isStatusApproved(a.status)).length;
        const rejectedAssignments = scopedAssignments.filter(a => isStatusRejected(a.status)).length;
        const pendingAssignments = scopedAssignments.filter(a => isStatusPending(a.status)).length;
        const totalAssignments = scopedAssignments.length;
        const expiringCount = reviewPeople
          .filter(p => (p.studentId && assignmentEligibility.ids.has(p.studentId))
            || assignmentEligibility.sids.has(p.sid)
            || (p.email && assignmentEligibility.emails.has(normalizeEmail(p.email))))
          .filter(p => effective.includes(programIdForPerson(p)))
          .filter(p => getHealthcareReadinessSummary(p).hasExpiring)
          .length;

	        if (metricPending) metricPending.textContent = String(submittedReviewStudentCount);
	        if (metricApproved) metricApproved.textContent = `${approvedAssignments}/${totalAssignments}`;
	        if (metricApprovedNote) metricApprovedNote.textContent = totalAssignments ? 'Approved / total assignments' : 'No assignments in window';
        if (metricRejected) metricRejected.textContent = String(rejectedAssignments);
        if (metricRejectedNote) metricRejectedNote.textContent = rejectedAssignments ? 'Requires follow up' : 'No rejected assignments';
        if (metricExpiring) metricExpiring.textContent = String(expiringCount);
        if (metricExpiringNote) metricExpiringNote.textContent = expiringCount ? 'Follow up this week' : 'No expiring items';

        const range = getSummaryRange();
        const rangedAssignments = scopedAssignments.filter(a => assignmentStartsWithinRange(a, range));
        const summaryApproved = rangedAssignments.filter(a => isStatusApproved(a.status)).length;
        const summaryRejected = rangedAssignments.filter(a => isStatusRejected(a.status)).length;
        const summaryPending = rangedAssignments.filter(a => isStatusPending(a.status)).length;
        const summaryTotal = rangedAssignments.length;

        if (summaryTotalEl) summaryTotalEl.textContent = String(summaryTotal);
        if (summaryApprovedEl) summaryApprovedEl.textContent = String(summaryApproved);
        if (summaryPendingEl) summaryPendingEl.textContent = String(summaryPending);
        if (summaryRejectedEl) summaryRejectedEl.textContent = String(summaryRejected);
        if (summaryNote){
          if (range.start && range.end){
            summaryNote.textContent = `Showing start dates from ${formatShortDate(range.start)} to ${formatShortDate(range.end)}.`;
          }else{
            summaryNote.textContent = 'Showing all upcoming and active assignments.';
          }
        }

        const notifications = [];
        if (submittedReviewStudentCount > 0){
          notifications.push({
            title: `${submittedReviewStudentCount} student${submittedReviewStudentCount === 1 ? '' : 's'} need healthcare review`,
            meta: 'Submitted or in-review healthcare requirements.',
            action: { label: 'Review submissions', href: 'review-healthcare.html' },
            badgeClass: 'text-bg-warning text-dark',
            badgeLabel: 'Action'
          });
        }
        if (rejectedAssignments > 0){
          notifications.push({
            title: `${rejectedAssignments} rejected assignment${rejectedAssignments === 1 ? '' : 's'} need attention`,
            meta: 'Resolve issues so assignments can be approved.',
            action: { label: 'View rejected', href: 'clinical-roster-healthcare.html?status=rejected' },
            badgeClass: 'text-bg-danger',
            badgeLabel: 'Review'
          });
        }
        const upcomingPending = getUpcomingPendingCount(scopedAssignments);
        if (upcomingPending > 0){
          notifications.push({
            title: `${upcomingPending} assignment${upcomingPending === 1 ? '' : 's'} start soon`,
            meta: 'Pending approvals within the next 7 days.',
            action: { label: 'Open clinical roster', href: 'clinical-roster-healthcare.html' },
            badgeClass: 'text-bg-secondary',
            badgeLabel: 'Upcoming'
          });
        }
        buildNotificationList(notifications);
      }

      renderProgramFilters('');
      summarize();
      initReadinessFilters();
      renderReadinessTable();

      filters.addEventListener('change', summarize);
      programSearch?.addEventListener('input', (e) => {
        renderProgramFilters(e.target.value || '');
        summarize();
      });
      selectAllBtn?.addEventListener('click', () => {
        filters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
        summarize();
      });
      clearBtn?.addEventListener('click', () => {
        filters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
        summarize();
      });
      summaryStartInput?.addEventListener('change', summarize);
      summaryEndInput?.addEventListener('change', summarize);

      if (readinessToggle && readinessWrapper){
        readinessToggle.addEventListener('click', () => {
          const expanded = readinessWrapper.dataset.expanded === 'true';
          readinessWrapper.dataset.expanded = (!expanded).toString();
          readinessWrapper.style.maxHeight = expanded ? '260px' : '520px';
          readinessToggle.textContent = expanded ? 'View all' : 'Collapse';
        });
      }
    })();
  
