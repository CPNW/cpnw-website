
    (function(){
      const programs = [
        { id:'bsn', name:'BSN' },
        { id:'adn', name:'ADN' },
        { id:'surg', name:'Surg Tech' },
        { id:'allied', name:'Allied Health' }
      ];

	      const requests = [
	        { school:'Northwest U', program:'BSN', programId:'bsn', students:8, start:'Mar 18', status:'pending' },
	        { school:'Evergreen College', program:'Allied Health', programId:'allied', students:4, start:'Mar 25', status:'approved' },
	        { school:'Cascade State', program:'Practicum', programId:'bsn', students:6, start:'Apr 02', status:'reviewing' },
	        { school:'CPNW Education', program:'ADN', programId:'adn', students:5, start:'Apr 10', status:'pending' }
	      ];

	      const sites = [
	        { name:'Med-Surg (Downtown)', slots:4, status:'open' },
	        { name:'ICU (North Campus)', slots:1, status:'limited' },
	        { name:'Pediatrics (East)', slots:0, status:'full' }
	      ];

      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
      const ASSIGNMENT_GRACE_DAYS = 14;
      const ASSIGNMENT_WINDOW_DAYS = 42;
      const REVIEW_DECISIONS_KEY = 'cpnw-review-decisions-v1';
      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
      const HEALTHCARE_REVIEWABLE_STATUSES = new Set(['Submitted', 'In Review']);
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
        { id:'Surg Tech', base: 8, aySpan: 2 }
      ];
      const programIdMap = { 'BSN':'bsn', 'ADN':'adn', 'Surg Tech':'surg', 'Allied Health':'allied' };

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
        assignments.forEach(assignment => {
          if (!assignmentMatchesFacility(assignment, facilityNames)) return;
          if (!assignmentWithinWindow(assignment)) return;
          if (assignment.studentId) ids.add(String(assignment.studentId));
          if (assignment.studentSid) sids.add(String(assignment.studentSid));
        });
        return { ids, sids };
      }

      function buildReviewPeople(){
        const baseRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
          ? window.CPNW.getSharedRoster()
          : [];
        const people = baseRoster
          .filter(person => ['student','faculty','faculty-admin'].includes(person.role))
          .map(person => ({ ...person }));
        people.push(
          {
            name: 'Fran Faculty',
            email: 'fran.faculty@cpnw.org',
            program: 'BSN',
            school: 'CPNW Education',
            cohort: '',
            sid: 'EID-FF-001',
            verified: true,
            status: ''
          },
          {
            name: 'Faculty Admin (Demo)',
            email: 'facadmin@cpnw.org',
            program: 'BSN',
            school: 'CPNW Education',
            cohort: '',
            sid: 'EID-FA-001',
            verified: true,
            status: ''
          }
        );
        return people;
      }

      const filters = document.getElementById('programFilters');
      const programCount = document.getElementById('programCount');
      const programSearch = document.getElementById('programSearch');
      const selectAllBtn = document.getElementById('programSelectAll');
      const clearBtn = document.getElementById('programClear');
      const requestTableBody = document.getElementById('requestTableBody');
      const siteList = document.getElementById('siteList');

      const metricPending = document.getElementById('metricPending');
      const metricPendingNote = document.getElementById('metricPendingNote');
      const metricApproved = document.getElementById('metricApproved');
      const metricApprovedNote = document.getElementById('metricApprovedNote');
      const metricVerified = document.getElementById('metricVerified');
      const metricVerifiedNote = document.getElementById('metricVerifiedNote');
      const metricExpiring = document.getElementById('metricExpiring');
      const metricExpiringNote = document.getElementById('metricExpiringNote');

      if (!filters) return;

      const reviewPeople = buildReviewPeople();
      const storedAssignments = loadAssignments();
      const assignments = storedAssignments || seedAssignmentsFromPeople(reviewPeople);
      if (!storedAssignments){
        saveAssignments(assignments);
      }
      const facilityNames = getHealthcareFacilityNames();
      const assignmentEligibility = buildAssignmentEligibility(assignments, facilityNames);

      function programIdForPerson(person){
        return programIdMap[person?.program] || '';
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

      function statusBadge(status){
        const s = String(status || '').toLowerCase();
        if (s === 'pending') return '<span class="badge text-bg-warning text-dark">Pending</span>';
        if (s === 'approved') return '<span class="badge text-bg-success">Approved</span>';
        if (s === 'reviewing') return '<span class="badge text-bg-secondary">Reviewing</span>';
        return `<span class="badge text-bg-secondary">${status}</span>`;
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

	      function summarize(){
	        const selectedIds = getSelectedProgramIds();
	        const effective = selectedIds.length ? selectedIds : programs.map(p => p.id);
	        if (programCount){
	          programCount.textContent = effective.length === programs.length ? 'All' : String(effective.length);
	        }

	        const filteredRequests = requests.filter(r => effective.includes(r.programId));
	        const submittedReviewStudentCount = new Set(
	          reviewPeople
	            .filter(p => (p.studentId && assignmentEligibility.ids.has(p.studentId))
	              || assignmentEligibility.sids.has(p.sid))
	            .filter(p => effective.includes(programIdForPerson(p)))
	            .filter(p => hasHealthcareReviewItems(p))
	            .map(p => p.studentId || p.sid)
	        ).size;
	        const pending = filteredRequests.filter(r => r.status === 'pending').length;
	        const approved = filteredRequests.filter(r => r.status === 'approved').length;

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
          const approvedAssignments = scopedAssignments.filter(a => String(a.status || '').toLowerCase() === 'approved').length;
          const totalAssignments = scopedAssignments.length;
	        // Demo placeholders for readiness/expiring that scale with request totals.
	        const verified = 24 + approved * 2;
	        const expiring = Math.max(0, 3 + pending - approved);

	        if (metricPending) metricPending.textContent = String(submittedReviewStudentCount);
	        if (metricApproved) metricApproved.textContent = `${approvedAssignments}/${totalAssignments}`;
	        if (metricApprovedNote) metricApprovedNote.textContent = totalAssignments ? 'Approved / total assignments' : 'No assignments in window';
	        if (metricVerified) metricVerified.textContent = String(verified);
	        if (metricVerifiedNote) metricVerifiedNote.textContent = 'All requirements passed';
	        if (metricExpiring) metricExpiring.textContent = String(expiring);
        if (metricExpiringNote) metricExpiringNote.textContent = expiring ? 'Follow up this week' : 'No expiring items';

        if (requestTableBody){
          requestTableBody.innerHTML = filteredRequests.map(r => `
            <tr>
              <td class="fw-semibold">${r.school}</td>
              <td>${r.program}</td>
              <td>${r.students}</td>
              <td>${r.start}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="text-body-secondary small">No requests match your filters.</td></tr>';
        }

        if (siteList){
          siteList.innerHTML = sites.map(s => {
            const badge = s.status === 'open'
              ? '<span class="badge text-bg-success">Open</span>'
              : s.status === 'limited'
                ? '<span class="badge text-bg-warning text-dark">Limited</span>'
                : '<span class="badge text-bg-secondary">Full</span>';
            const sub = s.slots ? `${s.slots} slot${s.slots === 1 ? '' : 's'} open` : 'Waitlist';
            return `
              <li class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-semibold">${s.name}</div>
                  <p class="small text-body-secondary mb-0">${sub}</p>
                </div>
                ${badge}
              </li>
            `;
          }).join('');
        }
      }

      renderProgramFilters('');
      summarize();

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
    })();
  
