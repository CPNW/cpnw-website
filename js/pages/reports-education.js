
    (function(){
      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];
      const isHealthcareView = window.location.pathname.includes('/healthcare-views/');
      const currentUser = (() => {
        try{
          return JSON.parse(localStorage.getItem('cpnw-current-user') || 'null');
        }catch(err){
          return null;
        }
      })();
      const canDeleteDocs = !!currentUser?.permissions?.canDelete;
      const currentPrograms = Array.isArray(currentUser?.programs)
        ? currentUser.programs
        : currentUser?.programs ? [currentUser.programs] : [];
      const accessPrograms = (window.CPNW && typeof window.CPNW.getProgramAccessPrograms === 'function')
        ? window.CPNW.getProgramAccessPrograms(currentUser)
        : currentPrograms;
      const accessSummary = (window.CPNW && typeof window.CPNW.getProgramAccessSummary === 'function')
        ? window.CPNW.getProgramAccessSummary(currentUser)
        : { schools: [], programsBySchool: {}, programs: accessPrograms };
      const allowedPrograms = accessPrograms.map(p => String(p || '').toLowerCase());
      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
      const ASSIGNMENT_WINDOW_DAYS = 42;
      const ASSIGNMENT_GRACE_DAYS = 14;

      function normalizeProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'surg tech';
        if (name.includes('rad')) return 'radiologic technology';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function formatProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return String(label || '').trim();
      }

      function normalizeSchool(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalize(value){
        return String(value || '').trim().toLowerCase();
      }

      function hydrateAssignments(list){
        if (!Array.isArray(list)) return [];
        return list.map(item => {
          if (!item || typeof item !== 'object') return null;
          const start = item.start ? new Date(item.start) : null;
          const end = item.end ? new Date(item.end) : null;
          return { ...item, start, end };
        }).filter(Boolean);
      }

      function loadAssignments(){
        try{
          const raw = localStorage.getItem(ASSIGNMENTS_KEY);
          if (!raw) return [];
          return hydrateAssignments(JSON.parse(raw));
        }catch{
          return [];
        }
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

      function assignmentMatchesFacility(assignment, facilityNames){
        if (!facilityNames.size) return false;
        return facilityNames.has(normalize(assignment?.location));
      }

      function assignmentWithinWindow(assignment){
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

      function buildHealthcareEligibility(){
        const assignments = loadAssignments();
        const facilityNames = getHealthcareFacilityNames();
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

      const programToSchools = new Map();
      Object.entries(accessSummary.programsBySchool || {}).forEach(([school, programs]) => {
        programs.forEach(program => {
          const key = normalizeProgramLabel(program);
          if (!programToSchools.has(key)) programToSchools.set(key, []);
          const list = programToSchools.get(key);
          if (!list.includes(school)) list.push(school);
        });
      });
      const programSchoolCursor = new Map();
      function pickSchoolForProgram(program){
        const key = normalizeProgramLabel(program);
        const schools = programToSchools.get(key);
        if (schools && schools.length){
          const idx = programSchoolCursor.get(key) || 0;
          programSchoolCursor.set(key, idx + 1);
          return schools[idx % schools.length];
        }
        return currentUser?.profile?.school || accessSummary.schools?.[0] || 'CPNW Education';
      }
      const programAccessSet = new Set();
      Object.entries(accessSummary.programsBySchool || {}).forEach(([school, programs]) => {
        programs.forEach(program => {
          programAccessSet.add(`${normalizeSchool(school)}|${normalizeProgramLabel(program)}`);
        });
      });

      const programDefs = [
        { id:'BSN', base: 12, aySpan: 2 },
        { id:'ADN', base: 10, aySpan: 2 },
        { id:'Surg Tech', base: 8, aySpan: 2 },
        { id:'Radiologic Technology', base: 6, aySpan: 2 }
      ];
	      const termAdjust = { Fall:3, Winter:1, Spring:0, Summer:-2 };
	      const asISODate = (date) => {
	        const d = date instanceof Date ? date : new Date(date);
	        if (Number.isNaN(d.getTime())) return '';
	        return d.toISOString().slice(0, 10);
	      };
	      const addDays = (days) => {
	        const d = new Date();
	        d.setDate(d.getDate() + days);
	        return d;
	      };
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
              school: pickSchoolForProgram(p.id),
              ayStart,
              students
            });
	          });
	        });
	      });
      let cohorts = cohortSeeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);
      if (programAccessSet.size && !isHealthcareView){
        cohorts = cohorts.filter(c => {
          const key = `${normalizeSchool(c.school)}|${normalizeProgramLabel(c.program)}`;
          return programAccessSet.has(key);
        });
      }

      // Merge custom cohorts + membership deltas (stored in localStorage via main.js)
      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = cohortAPI ? cohortAPI.getMembershipCounts() : {};
	      if (cohortAPI){
	        cohorts = cohorts.map(c => {
	          const delta = membershipCounts[cohortAPI.seedKeyForLabel(c.cohortLabel)] || 0;
	          return { ...c, students: c.students + delta };
	        });
	        const custom = cohortAPI
	          .listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX })
	          .map(c => ({ ...c }));
	        cohorts = cohorts.concat(custom);
	      }
      cohorts = cohorts.map(c => ({ ...c, school: c.school || pickSchoolForProgram(c.program) }));

      // Cohort filter
      const cohortFilter = document.getElementById('cohortFilter');
      const cohortFilterWrap = cohortFilter?.closest('[data-cohort-filter]');
      const cohortFilterMenu = cohortFilterWrap?.querySelector('[data-cohort-menu]');

	      // Build people data
	      const users = [];
	      function applyCohortOverride(user){
        if (!cohortAPI) return user;
        const override = typeof cohortAPI.getUserCohortLabel === 'function'
          ? cohortAPI.getUserCohortLabel(user.email)
          : null;
        if (override !== null && override !== undefined){
          user.cohort = override;
	        }
	        return user;
	      }
	      function computeComplianceStatus(user){
	        const req = user.reqs || {};
	        const hasExpiring = ['cpnw','ed','hc'].some(k => String(req[k] || '').toLowerCase() === 'expiring');
	        if (hasExpiring) return 'expiring';
	        const hasIncomplete = ['cpnw','ed','hc'].some(k => String(req[k] || '').toLowerCase() === 'incomplete');
	        if (hasIncomplete) return 'incomplete';
	        return 'complete';
	      }
	      cohorts.forEach((c, idx) => {
	        const base = Math.min(12, c.students);
	        for (let i=0; i<base; i++){
	          const expiresInDays = (i % 9 === 0) ? (7 + (idx % 24)) : (i % 11 === 0) ? (14 + (idx % 16)) : (i % 13 === 0) ? (22 + (idx % 8)) : null;
	          const expDate = expiresInDays ? asISODate(addDays(expiresInDays)) : '';
	          // OIG/SAM are run bi-monthly (1st/15th). Newer students may be blank; most results are Pass.
	          let oig = 'pass';
	          let sam = 'pass';
	          const screenSeed = (idx * 97 + i * 131) % 1000; // stable demo distribution
	          if (screenSeed < 80){
	            oig = '';
	            sam = '';
	          }else if (screenSeed === 999){
	            oig = 'fail';
	            sam = 'pass';
	          }
          const studentId = `${idx+1}-${i+1}`;
          const person = {
            name: `Student ${studentId}`,
            email: `student${idx+1}${i+1}@demo.cpnw.org`,
            program: c.program,
            school: c.school,
            cohort: c.cohortLabel,
            role: 'student',
            studentId,
            sid: String(1000 + idx * 50 + i),
	            reqs: {
	              cpnw: (i % 3) ? 'complete' : 'incomplete',
	              ed: (i % 4) ? 'complete' : 'incomplete',
	              hc: (i % 5) ? 'complete' : 'incomplete',
	              oig,
	              sam
	            },
	            reqMeta: {
	              expiringAt: expDate,
	              expiringDays: expiresInDays
	            },
	            docs: Math.max(1, (i % 4)),
	            docItems: [
	              { file:'Immunization.pdf', req:'Immunization', date:'2025-02-10' },
	              { file:'BLS.pdf', req:'BLS', date:'2025-02-08' }
	            ]
	          };
	          const rosterEntry = (window.CPNW && typeof window.CPNW.findRosterEntry === 'function')
	            ? window.CPNW.findRosterEntry({ studentId, sid: person.sid, email: person.email })
	            : null;
	          if (rosterEntry){
	            person.name = rosterEntry.name || person.name;
	            person.email = rosterEntry.email || person.email;
	            person.sid = rosterEntry.sid || person.sid;
	          }
	          // Add some realistic "Expiring" records (expiring within 30 days).
	          if (expiresInDays && expiresInDays <= 30){
	            if (i % 9 === 0) person.reqs.cpnw = 'expiring';
	            else if (i % 11 === 0) person.reqs.ed = 'expiring';
	            else if (i % 13 === 0) person.reqs.hc = 'expiring';
	          }
	          person.status = computeComplianceStatus(person);
	          users.push(applyCohortOverride(person));
	        }
	        // Add a few faculty and faculty-admin tied to this program
        users.push(applyCohortOverride({
          name: `Faculty ${c.program} ${idx+1}`,
          email: `faculty${idx+1}@demo.cpnw.org`,
          program: c.program,
          school: c.school,
          cohort: c.cohortLabel,
          role: 'faculty',
	          reqs: {
	            cpnw: 'complete',
	            ed: 'complete',
	            hc: 'complete',
	            oig: 'pass',
	            sam: 'pass'
	          },
	          docs: 1,
	          docItems: [{ file:'FacultyCert.pdf', req:'Faculty Credential', date:'2025-02-12' }]
	        }));
        users.push(applyCohortOverride({
          name: `Faculty Admin ${c.program} ${idx+1}`,
          email: `facadmin${idx+1}@demo.cpnw.org`,
          program: c.program,
          school: c.school,
          cohort: c.cohortLabel,
          role: 'faculty-admin',
	          reqs: {
	            cpnw: 'complete',
	            ed: 'complete',
	            hc: 'complete',
	            oig: (idx % 2) ? 'pass' : 'fail',
	            sam: (idx % 3) ? 'pass' : 'fail'
	          },
	          docs: 1,
	          docItems: [{ file:'AdminAccess.pdf', req:'Admin Approval', date:'2025-02-11' }]
	        }));
	      });
	      // Ensure any non-student rows still get a computed compliance status.
	      users.forEach(u => { u.status = u.status || computeComplianceStatus(u); });
      users.push(applyCohortOverride({
        name: 'Fran Faculty',
        email: 'fran.faculty@cpnw.org',
        program: 'BSN',
        school: pickSchoolForProgram('BSN'),
        cohort: '',
        role: 'faculty',
	        reqs: {
	          cpnw: 'complete',
	          ed: 'complete',
	          hc: 'complete',
          oig: 'pass',
          sam: 'pass'
        },
        docs: 1,
        docItems: [{ file:'FacultyCert.pdf', req:'Faculty Credential', date:'2025-02-12' }]
      }));

      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];
      function normalizeProgramDisplay(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return label || 'BSN';
      }
      demoPeople.forEach(person => {
        if (!['student', 'faculty'].includes(person.role)) return;
        const exists = users.some(u => u.email.toLowerCase() === person.email.toLowerCase());
        if (exists) return;
        const program = normalizeProgramDisplay(person.programs?.[0]);
        const school = person.schools?.[0] || pickSchoolForProgram(program);
        const record = applyCohortOverride({
          name: person.name,
          email: person.email,
          program,
          school,
          cohort: person.cohort || '',
          role: person.role,
          reqs: person.reqs || { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
          docs: person.docItems ? person.docItems.length : 0,
          docItems: person.docItems || []
        });
        record.status = computeComplianceStatus(record);
        users.push(record);
      });

      if (programAccessSet.size && !isHealthcareView){
        for (let i = users.length - 1; i >= 0; i--){
          const key = `${normalizeSchool(users[i].school)}|${normalizeProgramLabel(users[i].program)}`;
          if (!programAccessSet.has(key)){
            users.splice(i, 1);
          }
        }
      }
      if (isHealthcareView){
        const { ids, sids } = buildHealthcareEligibility();
        for (let i = users.length - 1; i >= 0; i--){
          const user = users[i];
          const role = String(user.role || '').toLowerCase();
          if (!['student','faculty','faculty-admin'].includes(role)){
            users.splice(i, 1);
            continue;
          }
          const idMatch = user.studentId && ids.has(String(user.studentId));
          const sidMatch = user.sid && sids.has(String(user.sid));
          if (!idMatch && !sidMatch){
            users.splice(i, 1);
          }
        }
      }

      const statusButtons = document.querySelectorAll('[data-status]');
      const reportSearch = document.getElementById('reportSearch');
      const locationFilter = document.getElementById('locationFilter'); // placeholder, not applied to sample data
      const programFilterSelect = document.getElementById('programFilter');
      const reportTableBody = document.getElementById('reportTableBody');
      const selectAllReports = document.getElementById('selectAllReports');
      const showSelectedBtn = document.getElementById('showSelected');
      const exportBtn = document.getElementById('exportBtn');
      const reportPageSizeSelect = document.getElementById('reportPageSize');
      const reportPrevPage = document.getElementById('reportPrevPage');
      const reportNextPage = document.getElementById('reportNextPage');
      const reportPageInfo = document.getElementById('reportPageInfo');
      const reqModalBody = document.getElementById('reqModalBody');
      const reqModalLabel = document.getElementById('reqModalLabel');
      const reqModalSub = document.getElementById('reqModalSub');
      function getProgramsBySchool(){
        if (Object.keys(accessSummary.programsBySchool || {}).length){
          return accessSummary.programsBySchool;
        }
        return cohorts.reduce((acc, c) => {
          if (!c.school || !c.program) return acc;
          acc[c.school] ||= [];
          acc[c.school].push(c.program);
          return acc;
        }, {});
      }

      const programFilterWrap = programFilterSelect?.closest('[data-program-filter]');
      const programFilterMenu = programFilterWrap?.querySelector('[data-program-menu]');
      const programFilterControl = (window.CPNW && typeof window.CPNW.buildProgramFilter === 'function')
        ? window.CPNW.buildProgramFilter({
          input: programFilterSelect,
          menu: programFilterMenu,
          programsBySchool: getProgramsBySchool(),
          formatProgramLabel,
          onChange: () => {
            reportPage = 1;
            updateCohortItems();
            renderReports();
          }
        })
        : null;
      const cohortFilterControl = (isHealthcareView && window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
        ? window.CPNW.buildCheckboxMultiSelect({
          input: cohortFilter,
          menu: cohortFilterMenu,
          placeholder: 'All cohorts',
          onChange: () => {
            reportPage = 1;
            renderReports();
          }
        })
        : null;

      function getCohortItems(programSelections = []){
        const hasProgramSelections = programSelections.length > 0;
        const filtered = cohorts.filter(c => {
          if (!hasProgramSelections) return true;
          return programSelections.some(sel =>
            normalizeSchool(sel.school) === normalizeSchool(c.school)
            && normalizeProgramLabel(sel.program) === normalizeProgramLabel(c.program)
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
        if (cohortFilter){
          const opts = ['', '__unassigned__'];
          cohorts.forEach(c => opts.push(c.cohortLabel));
          const unique = Array.from(new Set(opts));
          cohortFilter.innerHTML = unique.map(val => {
            if (!val) return `<option value="">All cohorts</option>`;
            if (val === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
            return `<option value="${val}">${val}</option>`;
          }).join('');
        }
      }

      updateCohortItems();
      let currentStatus = 'all';
      let reportPage = 1;
      let reportPageSize = Number(reportPageSizeSelect?.value || 10);
      const selectedIds = new Set();

      function statusBadge(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const normalized = val.toLowerCase();
        let cls = 'text-bg-secondary';
        if (normalized === 'complete' || normalized === 'pass') cls = 'text-bg-success';
        else if (normalized === 'expiring') cls = 'text-bg-warning text-dark';
        else cls = 'text-bg-danger';
        const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        return `<span class="badge ${cls}">${label}</span>`;
      }

      const reqCounts = { cpnw:20, ed:4, hc:6 };
      const reqLabels = { cpnw:'CPNW', ed:'Education', hc:'Healthcare' };

	      function buildReqList(type, overallStatus){
	        const total = reqCounts[type] || 0;
	        const list = [];
	        for (let i=1;i<=total;i++){
	          let itemStatus = 'complete';
	          if (overallStatus === 'expiring'){
	            itemStatus = (i % 5 === 0) ? 'expiring' : 'complete';
	          }else if (overallStatus !== 'complete'){
	            itemStatus = (i % 4 === 0) ? 'incomplete' : 'complete';
	          }
	          list.push({ name: `${reqLabels[type] || type.toUpperCase()} Req ${i}`, status: itemStatus });
	        }
	        return list;
	      }

      function renderReports(showOnlySelected = false){
        const q = (reportSearch?.value || '').toLowerCase();
        const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
        const hasProgramSelections = programSelections.length > 0;
        const validCohorts = new Set([...cohorts.map(c => c.cohortLabel), '__unassigned__']);
        const cohortSelections = cohortFilterControl
          ? cohortFilterControl.getSelection().filter(val => validCohorts.has(val))
          : (cohortFilter && validCohorts.has(cohortFilter.value) && cohortFilter.value ? [cohortFilter.value] : []);
        const cohortSet = new Set(cohortSelections);
        const hasCohortSelections = cohortSet.size > 0;
	        const filtered = users.filter(u=>{
	          if (currentStatus !== 'all' && u.status !== currentStatus) return false;
	          if (hasProgramSelections){
	            const matchesProgram = programSelections.some(sel =>
	              normalizeSchool(sel.school) === normalizeSchool(u.school)
	              && normalizeProgramLabel(sel.program) === normalizeProgramLabel(u.program)
	            );
	            if (!matchesProgram) return false;
	          }
          if (hasCohortSelections){
            const cohortLabel = (u.cohort || '').trim();
            const wantsUnassigned = cohortSet.has('__unassigned__');
            if (!cohortLabel){
              if (!wantsUnassigned) return false;
            }else if (!cohortSet.has(cohortLabel)){
              return false;
            }
          }
          if (showOnlySelected && !selectedIds.has(u.email)) return false;
          if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
          return true;
        });
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / reportPageSize));
        if (reportPage > totalPages) reportPage = totalPages;
        const start = (reportPage - 1) * reportPageSize;
        const end = Math.min(start + reportPageSize, total);
        const pageItems = filtered.slice(start, end);

	        reportTableBody.innerHTML = '';
	        pageItems.forEach(u=>{
	          const tr = document.createElement('tr');
	          tr.innerHTML = `
	            <td><input type="checkbox" class="form-check-input report-row" data-id="${u.email}" ${selectedIds.has(u.email) ? 'checked' : ''}></td>
	            <td class="fw-semibold">${u.name}</td>
	            <td>${u.program}</td>
	            <td>${u.cohort ? u.cohort : '<span class="text-body-secondary">Unassigned</span>'}</td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="cpnw" data-user="${u.email}">${statusBadge(u.reqs?.cpnw)}</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="ed" data-user="${u.email}">${statusBadge(u.reqs?.ed)}</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="hc" data-user="${u.email}">${statusBadge(u.reqs?.hc)}</button></td>
	            <td>${statusBadge(u.reqs?.oig)}</td>
	            <td>${statusBadge(u.reqs?.sam)}</td>
	            <td><button class="btn btn-outline-secondary btn-sm" data-docs="${u.name}">Open</button></td>
	          `;
	          reportTableBody.appendChild(tr);
	        });

        if (reportPageInfo){
          reportPageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (reportPrevPage && reportNextPage){
          reportPrevPage.disabled = reportPage <= 1;
          reportNextPage.disabled = end >= total;
        }
      }

      statusButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          statusButtons.forEach(b=>{
            b.classList.remove('btn-cpnw','btn-cpnw-primary');
            b.classList.add('btn-outline-secondary');
          });
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
          currentStatus = btn.dataset.status;
          reportPage = 1;
          renderReports();
        });
      });

      [reportSearch, cohortFilter].forEach(el=>{
        if (!el) return;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', ()=>{
          reportPage = 1;
          renderReports();
        });
      });

      if (reportPageSizeSelect){
        reportPageSizeSelect.addEventListener('change', () => {
          reportPageSize = Number(reportPageSizeSelect.value || 10);
          reportPage = 1;
          renderReports();
        });
      }
      if (reportPrevPage){
        reportPrevPage.addEventListener('click', () => {
          if (reportPage > 1){
            reportPage -= 1;
            renderReports();
          }
        });
      }
      if (reportNextPage){
        reportNextPage.addEventListener('click', () => {
          reportPage += 1;
          renderReports();
        });
      }

      document.addEventListener('click', (e)=>{
        if (e.target.matches('.report-row')){
          const id = e.target.dataset.id;
          if (id){
            if (e.target.checked){ selectedIds.add(id); }
            else{ selectedIds.delete(id); }
          }
        }

        const reqBtn = e.target.closest('.req-cell');
        if (reqBtn){
          const type = reqBtn.dataset.reqType;
          const userId = reqBtn.dataset.user;
          const person = users.find(u=>u.email === userId);
          if (person && reqCounts[type]){
            const list = buildReqList(type, person.reqs?.[type]);
            reqModalLabel.textContent = `${reqLabels[type] || type.toUpperCase()} requirements`;
            reqModalSub.textContent = person.name;
            reqModalBody.innerHTML = list.map(item=>`
              <tr>
                <td>${item.name}</td>
                <td>${statusBadge(item.status)}</td>
              </tr>
            `).join('');
            const modal = new bootstrap.Modal(document.getElementById('reqModal'));
            modal.show();
          }
        }

        const btn = e.target.closest('[data-docs]');
        if (!btn) return;
        const name = btn.dataset.docs;
        const person = users.find(u=>u.name === name);
        if (!person) return;
        const tbody = document.getElementById('docsTableBody');
        const permissionAlert = document.querySelector('[data-docs-permission]');
        const removeHeader = document.getElementById('docsRemoveHeader');
        if (permissionAlert){
          permissionAlert.classList.toggle('d-none', canDeleteDocs);
        }
        if (removeHeader){
          removeHeader.textContent = canDeleteDocs ? 'Remove' : 'Remove (no access)';
        }
        tbody.innerHTML = (person.docItems || []).map(d=>`
          <tr>
            <td><input type="checkbox" class="form-check-input"></td>
            <td>${d.file}</td>
            <td>${d.req}</td>
            <td>${d.date}</td>
            <td class="text-end">
              <button
                class="btn btn-link ${canDeleteDocs ? 'text-danger' : 'text-body-secondary'} p-0"
                type="button"
                ${canDeleteDocs ? '' : 'disabled aria-disabled="true"'}
              >
                ${canDeleteDocs ? '🗑' : '🔒'}
              </button>
            </td>
          </tr>
        `).join('');
        const modal = new bootstrap.Modal(document.getElementById('docsModal'));
        modal.show();
      });

      if (selectAllReports){
        selectAllReports.addEventListener('change', () => {
          const check = selectAllReports.checked;
          document.querySelectorAll('.report-row').forEach(cb => {
            cb.checked = check;
            const id = cb.dataset.id;
            if (id){
              if (check) selectedIds.add(id);
              else selectedIds.delete(id);
            }
          });
        });
      }

      showSelectedBtn?.addEventListener('click', () => {
        renderReports(true);
      });

      exportBtn?.addEventListener('click', () => {
        alert(`Exporting ${selectedIds.size} selected records (demo).`);
      });

      renderReports();
    })();
  
