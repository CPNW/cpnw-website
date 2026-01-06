
    (function(){
      // Mirror cohort logic to keep student counts in sync with dashboard
      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const THIS_YEAR = TODAY.getFullYear();
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? THIS_YEAR : THIS_YEAR - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall', 'Winter', 'Spring', 'Summer'];
      const termAdjust = { Fall: 3, Winter: 1, Spring: 0, Summer: -2 };
      const isHealthcareView = window.location.pathname.includes('/healthcare-views/');
      const programDefs = [
        { id: 'bsn', name: 'BSN', base: 12, aySpan: 2 },
        { id: 'adn', name: 'ADN', base: 10, aySpan: 2 },
        { id: 'surg', name: 'Surg Tech', base: 8, aySpan: 2 },
        { id: 'rad', name: 'Radiologic Technology', base: 6, aySpan: 2 },
        { id: 'resp', name: 'Respiratory Care', base: 7, aySpan: 2 },
        { id: 'med', name: 'Medical Assistant', base: 6, aySpan: 2 },
        { id: 'sono', name: 'Diagnostic Medical Sonography', base: 6, aySpan: 2 }
      ];

      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = cohortAPI ? cohortAPI.getMembershipCounts() : {};
      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;
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

      // DOM refs
      const statusChips = document.querySelectorAll('[data-status-chip]');
      const userSearch = document.getElementById('userSearch');
      const roleFilter = document.getElementById('roleFilter');
      const programFilter = document.getElementById('programFilter');
      const cohortFilter = document.getElementById('cohortFilter');
      const userTableBody = document.getElementById('userTableBody');
      const tableTitle = document.getElementById('tableTitle');
      const tableSubtitle = document.getElementById('tableSubtitle');
      const selectAll = document.getElementById('selectAll');
      const bulkAction = document.getElementById('bulkAction');
      const pageSizeSelect = document.getElementById('pageSize');
      const prevPageBtn = document.getElementById('prevPage');
      const nextPageBtn = document.getElementById('nextPage');
      const pageInfo = document.getElementById('pageInfo');

      // Modal refs
      const assignModalEl = document.getElementById('assignCohortModal');
      const assignCohortModalLabel = document.getElementById('assignCohortModalLabel');
      const assignUserSummary = document.getElementById('assignUserSummary');
      const assignProgramEl = document.getElementById('assignProgram');
      const assignCohortSelect = document.getElementById('assignCohortSelect');
      const assignExisting = document.getElementById('assignExisting');
      const assignNew = document.getElementById('assignNew');
      const assignUnassigned = document.getElementById('assignUnassigned');
      const newCohortWrap = document.getElementById('newCohortWrap');
      const newCohortName = document.getElementById('newCohortName');
      const newCohortRemaining = document.getElementById('newCohortRemaining');
      const newCohortCollision = document.getElementById('newCohortCollision');
      const assignApproveBtn = document.getElementById('assignApproveBtn');
      const assignError = document.getElementById('assignError');

      function normalizeProgramKey(label){
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

      function formatProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('resp')) return 'Respiratory Care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'Diagnostic Medical Sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'Medical Assistant';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return String(label || '').trim();
      }

      function normalizeSchool(value){
        return String(value || '').trim().toLowerCase();
      }

      const programToSchools = new Map();
      Object.entries(accessSummary.programsBySchool || {}).forEach(([school, programs]) => {
        programs.forEach(program => {
          const key = normalizeProgramKey(program);
          if (!programToSchools.has(key)) programToSchools.set(key, []);
          const list = programToSchools.get(key);
          if (!list.includes(school)) list.push(school);
        });
      });
      const programSchoolCursor = new Map();
      function pickSchoolForProgram(program){
        const key = normalizeProgramKey(program);
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
          programAccessSet.add(`${normalizeSchool(school)}|${normalizeProgramKey(program)}`);
        });
      });

      function getProgramsBySchool(){
        return Object.keys(accessSummary.programsBySchool || {}).length
          ? accessSummary.programsBySchool
          : {};
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
            currentPage = 1;
            updateTable();
          }
        })
        : null;

      function deriveAY(term, startYear){
        const year = Number(startYear);
        const isFall = term.toLowerCase() === 'fall';
        const ayStart = isFall ? year : year - 1;
        const ayEnd = ayStart + 1;
        return { ayStart, ayEnd };
      }

      const cohortSeeds = [];
      programDefs.forEach(p => {
        const ayStarts = Array.from({length: p.aySpan}, (_, i) => CURRENT_AY_START - i);
        ayStarts.forEach(ay => {
          TERMS.forEach(term => {
            const students = Math.max(8, p.base + termAdjust[term] + (CURRENT_AY_START - ay));
            const cohortLabel = `${p.name} – ${term} ${term === 'Fall' ? ay : ay + 1}`;
            const seedKey = cohortAPI ? cohortAPI.seedKeyForLabel(cohortLabel) : `seed:${cohortLabel}`;
            const delta = membershipCounts[seedKey] || 0;
            cohortSeeds.push({
              programId: p.id,
              programName: p.name,
              term,
              year: term === 'Fall' ? ay : ay + 1,
              school: pickSchoolForProgram(p.name),
              students: students + delta,
              ayStart: deriveAY(term, term === 'Fall' ? ay : ay + 1).ayStart
            });
          });
        });
      });

      const seedActiveCohorts = cohortSeeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);
      const customCohorts = cohortAPI ? cohortAPI.listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX }) : [];
      let activeCohorts = seedActiveCohorts
        .map(c => ({
          cohortLabel: `${c.programName} – ${c.term} ${c.year}`,
          program: c.programName,
          ayStart: c.ayStart,
          students: c.students,
          seed: true
        }))
        .concat(customCohorts);
      activeCohorts = activeCohorts.map(c => ({
        ...c,
        school: c.school || pickSchoolForProgram(c.program || c.programName)
      }));

      if (programAccessSet.size && !isHealthcareView){
        activeCohorts = activeCohorts.filter(c => {
          const key = `${normalizeSchool(c.school)}|${normalizeProgramKey(c.program)}`;
          return programAccessSet.has(key);
        });
      }

      function applyStoredCohort(item){
        if (!cohortAPI) return item;
        const override = typeof cohortAPI.getUserCohortLabel === 'function'
          ? cohortAPI.getUserCohortLabel(item.email)
          : null;
        if (override === null || override === undefined) return item;
        return { ...item, cohortLabel: override };
      }

      // Build cohort filter options
      if (cohortFilter){
        if (isHealthcareView){
          cohortFilter.innerHTML = '<option value="">All cohorts</option>';
          cohortFilter.disabled = true;
        }else{
        const opts = ['', '__unassigned__'];
        activeCohorts.forEach(c => opts.push(c.cohortLabel));
        const unique = Array.from(new Set(opts));
        cohortFilter.innerHTML = unique.map(val => {
          if (!val) return `<option value="">All cohorts</option>`;
          if (val === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
          return `<option value="${val}">${val}</option>`;
        }).join('');
        }
      }

      const data = [];
      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];

      function normalizeProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('resp')) return 'Respiratory Care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'Diagnostic Medical Sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'Medical Assistant';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return label || 'BSN';
      }

      if (isHealthcareView){
        const accessProgramSet = new Set(accessPrograms.map(p => normalizeProgramKey(p)));
        const accessSchoolSet = new Set((accessSummary.schools || []).map(normalizeSchool));
        demoPeople.forEach(person => {
          const role = String(person.role || '').toLowerCase();
          if (role !== 'healthcare') return;
          if (!person.permissions?.canCoordinate) return;
          const programs = Array.isArray(person.programs) ? person.programs : (person.programs ? [person.programs] : []);
          const schools = Array.isArray(person.schools) ? person.schools : (person.schools ? [person.schools] : []);
          const programMatch = programs.find(p => accessProgramSet.has(normalizeProgramKey(p)));
          if (accessProgramSet.size && !programMatch) return;
          const schoolMatch = schools.find(s => accessSchoolSet.has(normalizeSchool(s))) || schools[0] || person.profile?.school || programMatch || 'CPNW Healthcare Facility';
          const programLabel = programMatch || programs[0] || person.profile?.program || schoolMatch;
          data.push(applyStoredCohort({
            name: person.name,
            email: person.email,
            program: programLabel,
            school: schoolMatch,
            role: person.role,
            status: 'active',
            date: '2025-02-15',
            cohortLabel: ''
          }));
        });
      }else{
        demoPeople.forEach(person => {
          const role = String(person.role || '').toLowerCase();
          if (role === 'cpnw-reviewer' || role === 'healthcare') return;
          if (!['student','faculty','education'].includes(role)) return;
          const program = normalizeProgramLabel(person.programs?.[0]);
          const school = person.schools?.[0] || pickSchoolForProgram(program);
          data.push(applyStoredCohort({
            name: person.name,
            email: person.email,
            program,
            school,
            role: person.role,
            status: 'active',
            date: '2025-02-15',
            cohortLabel: person.cohort || ''
          }));
        });
      }

      if (programAccessSet.size){
        for (let i = data.length - 1; i >= 0; i--){
          const key = `${normalizeSchool(data[i].school)}|${normalizeProgramKey(data[i].program)}`;
          if (!programAccessSet.has(key)){
            data.splice(i, 1);
          }
        }
      }
      if (!isHealthcareView){
        // Generate active students from the same cohort-based roster used across pages
        activeCohorts.forEach((c, idx) => {
          const count = Math.min(12, Math.max(0, Number(c.students) || 0));
          for (let i = 0; i < count; i++){
            const studentId = `${idx+1}-${i+1}`;
            const entry = {
              name: `Student ${studentId}`,
              email: `student${idx+1}${i+1}@demo.cpnw.org`,
              program: c.program || c.programName || 'BSN',
              school: c.school || pickSchoolForProgram(c.program || c.programName),
              role: 'student',
              status: 'active',
              date: '2025-02-20',
              cohortLabel: c.cohortLabel,
              studentId,
              sid: String(1000 + idx * 50 + i)
            };
            const rosterEntry = (window.CPNW && typeof window.CPNW.findRosterEntry === 'function')
              ? window.CPNW.findRosterEntry({ studentId, sid: entry.sid, email: entry.email })
              : null;
            if (rosterEntry){
              entry.name = rosterEntry.name || entry.name;
              entry.email = rosterEntry.email || entry.email;
              entry.sid = rosterEntry.sid || entry.sid;
            }
            data.push(applyStoredCohort(entry));
          }
        });
        // Requests, inactive samples
        const cohortLabelsCycle = activeCohorts.map(c => c.cohortLabel);
        data.push(
          applyStoredCohort({ name: 'Riley Request', email: 'riley.req@cpnw.org', program: 'Surg Tech', school: pickSchoolForProgram('Surg Tech'), role: 'student', status: 'request-new', date: '2025-02-16', cohortLabel: cohortLabelsCycle[0] || '' }),
          applyStoredCohort({ name: 'Casey Return', email: 'casey.ret@cpnw.org', program: 'BSN', school: pickSchoolForProgram('BSN'), role: 'faculty', status: 'request-returned', date: '2025-02-12', cohortLabel: cohortLabelsCycle[1] || '' }),
          applyStoredCohort({ name: 'Taylor Inactive', email: 'taylor.inactive@cpnw.org', program: 'ADN', school: pickSchoolForProgram('ADN'), role: 'student', status: 'inactive', date: '2025-01-20', cohortLabel: cohortLabelsCycle[2] || '' })
        );
      }

      let currentStatus = 'active';
      let currentPage = 1;
      let pageSize = Number(pageSizeSelect?.value || 10);

	      function statusLabel(item){
	        switch(item.status){
	          case 'active': return 'Active';
	          case 'request-new': return 'Request: New';
	          case 'request-returned': return 'Request: Returned';
	          case 'inactive': return 'Inactive';
	          default: return item.status;
	        }
	      }

      function cohortActionLabel(item){
        const label = (item.cohortLabel || '').trim();
        return label ? 'Reassign Cohort' : 'Assign to Cohort';
      }

      function canAssignCohort(item){
        // Education coordinators/admin accounts are not assigned to cohorts/facilities.
        if (isHealthcareView) return false;
        return String(item?.role || '').toLowerCase() !== 'education';
      }

      function actionsFor(item){
        if (isHealthcareView){
          if (item.status === 'inactive'){
            return [{ key: 'reactivate', label: 'Reactivate' }];
          }
          return [{ key: 'deactivate', label: 'Deactivate' }];
        }
        if (item.status === 'active'){
          return [
            ...(canAssignCohort(item) ? [{ key: 'cohort', label: cohortActionLabel(item) }] : []),
            { key: 'deactivate', label: 'Deactivate' },
          ];
        }
	        if (item.status.startsWith('request')){
	          return [
	            { key: 'approve', label: 'Approve' },
	            { key: 'return', label: 'Return' },
	            { key: 'decline', label: 'Decline' }
	          ];
	        }
	        if (item.status === 'inactive'){
	          return [
	            { key: 'reactivate', label: 'Reactivate' }
	          ];
	        }
	        return [];
	      }

      function updateTable(){
        const query = (userSearch?.value || '').toLowerCase();
        const role = roleFilter?.value || '';
        const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
        const hasProgramSelections = programSelections.length > 0;
        const cohort = cohortFilter?.value || '';

	        const filtered = data.filter(item => {
	          if (currentStatus === 'requests'){
	            if (!(item.status === 'request-new' || item.status === 'request-returned')) return false;
	          } else {
	          if (currentStatus === 'active' && item.status !== 'active') return false;
	          if (currentStatus === 'inactive' && item.status !== 'inactive') return false;
	        }
	          if (role && item.role !== role) return false;
	          if (hasProgramSelections){
	            const matchesProgram = programSelections.some(sel =>
	              normalizeSchool(sel.school) === normalizeSchool(item.school)
	              && normalizeProgramKey(sel.program) === normalizeProgramKey(item.program)
	            );
	            if (!matchesProgram) return false;
	          }
          if (cohort && !isHealthcareView){
            if (cohort === '__unassigned__'){
              if (item.cohortLabel && item.cohortLabel.trim()) return false;
            }else{
              if (!item.cohortLabel?.includes(cohort)) return false;
            }
          }
          if (query && !`${item.name} ${item.email}`.toLowerCase().includes(query)) return false;
          return true;
        });

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, total);
        const pageItems = filtered.slice(start, end);

        userTableBody.innerHTML = '';
        pageItems.forEach(item => {
          const tr = document.createElement('tr');
          tr.dataset.userEmail = item.email;
          tr.innerHTML = `
            <td><input type="checkbox" class="form-check-input" /></td>
            <td class="fw-semibold">${item.name}</td>
	            <td>${item.email}</td>
	            <td>${item.program}</td>
	            <td class="text-capitalize">${item.role}</td>
	            <td>${item.date}</td>
	            <td class="text-end">
	              ${actionsFor(item).map(a => `<button class="btn btn-outline-secondary btn-sm me-1" type="button" data-row-action="${a.key}" data-user-email="${item.email}">${a.label}</button>`).join('')}
	            </td>
	          `;
	          userTableBody.appendChild(tr);
	        });

	        tableTitle.textContent =
	          currentStatus === 'requests' ? 'Account requests' :
	          currentStatus === 'inactive' ? 'Inactive users' :
	          'Active users';

	        tableSubtitle.textContent =
	          currentStatus === 'requests'
	            ? 'New and returned account requests'
	            : currentStatus === 'inactive'
	              ? 'Deactivate/reactivate accounts'
	              : 'All active accounts across your programs.';

        if (pageInfo){
          pageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (prevPageBtn && nextPageBtn){
          prevPageBtn.disabled = currentPage <= 1;
          nextPageBtn.disabled = end >= total;
        }
      }

      statusChips.forEach(btn => {
        btn.addEventListener('click', () => {
          statusChips.forEach(b => b.classList.remove('btn-cpnw-primary','btn-cpnw','btn-outline-secondary'));
          statusChips.forEach(b => b.classList.add('btn-outline-secondary'));
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
          currentStatus = btn.dataset.statusChip;
          selectAll.checked = false;
          currentPage = 1;
          updateTable();
        });
      });

      [userSearch, roleFilter, cohortFilter].forEach(el => {
        if (!el) return;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
          currentPage = 1;
          updateTable();
        });
      });

	      bulkAction?.addEventListener('click', () => {
	        alert('Bulk action drawer would open here (approve/return/decline/reactivate/deactivate).');
	      });

      if (pageSizeSelect){
        pageSizeSelect.addEventListener('change', () => {
          pageSize = Number(pageSizeSelect.value || 15);
          currentPage = 1;
          updateTable();
        });
      }
      if (prevPageBtn){
        prevPageBtn.addEventListener('click', () => {
          if (currentPage > 1){
            currentPage -= 1;
            updateTable();
          }
        });
      }
      if (nextPageBtn){
        nextPageBtn.addEventListener('click', () => {
          currentPage += 1;
          updateTable();
        });
      }

      function setAssignError(message){
        if (!assignError) return;
        if (!message){
          assignError.classList.add('d-none');
          assignError.textContent = '';
          return;
        }
        assignError.classList.remove('d-none');
        assignError.textContent = message;
      }

      function setRemaining(){
        if (!newCohortName || !newCohortRemaining) return;
        const max = 75;
        const remaining = Math.max(0, max - (newCohortName.value || '').length);
        newCohortRemaining.textContent = String(remaining);
      }

      function setCollision(message){
        if (!newCohortCollision) return;
        if (!message){
          newCohortCollision.classList.add('d-none');
          newCohortCollision.textContent = '';
          return;
        }
        newCohortCollision.classList.remove('d-none');
        newCohortCollision.textContent = message;
      }

      function validateNewCohortName(){
        if (!assignApproveBtn) return true;
        if (!assignNew?.checked) return true;
        const programName = assignProgramEl?.value || '';
        const name = (newCohortName?.value || '').trim();
        if (!name){
          setCollision('');
          assignApproveBtn.disabled = false;
          return true;
        }
        const fullLabel = `${programName} – ${name}`;
        const existsInList = activeCohorts.some(c => (c.cohortLabel || '').toLowerCase() === fullLabel.toLowerCase());
        const customCollision = cohortAPI?.findCustomCohortCollision(programName, name);
        if (existsInList || customCollision){
          setCollision(`A cohort named "${fullLabel}" already exists. Please choose a unique name.`);
          assignApproveBtn.disabled = true;
          return false;
        }
        setCollision('');
        assignApproveBtn.disabled = false;
        return true;
      }

      function buildAssignableCohorts(programName){
        const list = activeCohorts.filter(c => (c.program || '').toLowerCase() === String(programName || '').toLowerCase());
        // If program has no active cohorts, fall back to all active cohorts.
        return list.length ? list : activeCohorts;
      }

      function populateAssignSelect(programName){
        if (!assignCohortSelect) return;
        const items = buildAssignableCohorts(programName);
        const options = items.map(c => {
          const value = c.custom ? `custom:${c.cohortId}` : `seed:${c.cohortLabel}`;
          return `<option value="${value}">${c.cohortLabel}</option>`;
        });
        assignCohortSelect.innerHTML = options.join('') || '<option value="">No cohorts available</option>';
      }

      function bumpCohortMembershipFromSelection(selectionValue, selectedLabel, delta){
        if (!cohortAPI) return;
        if (!selectionValue) return;
        if (selectionValue.startsWith('custom:')){
          cohortAPI.bumpMembership(selectionValue.slice('custom:'.length), delta);
          return;
        }
        if (selectionValue.startsWith('seed:')){
          const label = selectedLabel || selectionValue.slice('seed:'.length);
          cohortAPI.bumpMembership(cohortAPI.seedKeyForLabel(label), delta);
        }
      }

      function createCustomCohort(programName, cohortName){
        if (!cohortAPI) return null;
        const record = cohortAPI.addCustomCohort({ name: cohortName, program: programName, ayStart: CURRENT_AY_START });
        if (!record) return null;
        const cohortLabel = `${record.program} – ${record.name}`;
        // Update in-memory cohort list so it immediately appears in dropdowns for this page session.
        activeCohorts.push({
          cohortId: record.id,
          cohortLabel,
          program: record.program,
          ayStart: record.ayStart,
          students: 0,
          custom: true
        });
        return { record, cohortLabel };
      }

      let pendingUser = null;
      let assignModal = null;
      if (assignModalEl){
        assignModal = new bootstrap.Modal(assignModalEl);
      }

      function openAssignModalFor(user, { title = 'Approve request' } = {}){
        pendingUser = user;
        setAssignError('');
        setCollision('');
        if (assignCohortModalLabel) assignCohortModalLabel.textContent = title;
        if (assignUserSummary){
          assignUserSummary.textContent = `${user.name} • ${user.email}`;
        }
        if (assignProgramEl){
          assignProgramEl.value = user.program || '';
        }
        if (assignExisting) assignExisting.checked = true;
        if (assignNew) assignNew.checked = false;
        if (assignUnassigned) assignUnassigned.checked = false;
        if (newCohortWrap) newCohortWrap.hidden = true;
        if (newCohortName) newCohortName.value = '';
        setRemaining();
        validateNewCohortName();
        populateAssignSelect(user.program);
        // Preselect current cohort if assigned.
        const currentLabel = (user.cohortLabel || '').trim();
        if (!currentLabel && assignUnassigned){
          assignUnassigned.checked = true;
          setAssignMode();
        }else if (currentLabel && assignCohortSelect){
          const match = Array.from(assignCohortSelect.options).find(o => (o.textContent || '').trim() === currentLabel);
          if (match){
            assignCohortSelect.value = match.value;
          }
        }
        assignModal?.show();
      }

      function setAssignMode(){
        const isNew = !!assignNew?.checked;
        const isUnassigned = !!assignUnassigned?.checked;
        if (newCohortWrap) newCohortWrap.hidden = !isNew;
        if (assignCohortSelect) assignCohortSelect.disabled = isUnassigned;
        if (!isNew) setAssignError('');
        if (!isNew) setCollision('');
        setRemaining();
        validateNewCohortName();
      }

      assignExisting?.addEventListener('change', setAssignMode);
      assignNew?.addEventListener('change', setAssignMode);
      assignUnassigned?.addEventListener('change', setAssignMode);
      newCohortName?.addEventListener('input', () => {
        setRemaining();
        validateNewCohortName();
      });

	      userTableBody?.addEventListener('click', (event) => {
	        const btn = event.target.closest('button[data-row-action]');
	        if (!btn) return;
	        const action = (btn.dataset.rowAction || '').trim();
	        const email = btn.dataset.userEmail;
	        const user = data.find(u => u.email === email);
	        if (!user) return;
	        if (action === 'approve'){
	          if (!canAssignCohort(user)){
	            if (!window.confirm(`Approve ${user.name}? (No cohort assignment for Education accounts)`)) return;
	            if (cohortAPI){
	              // Ensure no cohort mapping exists for education accounts.
	              cohortAPI.setUserCohort(user.email, null);
	            }
	            user.cohortLabel = '';
	            user.status = 'active';
	            user.date = new Date().toISOString().slice(0, 10);
	            updateTable();
	            return;
	          }
	          openAssignModalFor(user, { title: 'Approve request' });
	          return;
	        }
	        if (action === 'cohort'){
	          if (!canAssignCohort(user)){
	            alert('Education accounts cannot be assigned to cohorts.');
	            return;
	          }
	          const label = cohortActionLabel(user);
	          openAssignModalFor(user, { title: label });
	          return;
	        }
	        if (action === 'deactivate'){
	          if (!window.confirm(`Deactivate ${user.name}?`)) return;
	          user.status = 'inactive';
	          user.date = new Date().toISOString().slice(0, 10);
	          updateTable();
	          return;
	        }
	        if (action === 'reactivate'){
	          if (!window.confirm(`Reactivate ${user.name}?`)) return;
	          user.status = 'active';
	          user.date = new Date().toISOString().slice(0, 10);
	          updateTable();
	          return;
	        }
	      });

	      assignApproveBtn?.addEventListener('click', () => {
	        if (!pendingUser) return;
	        if (!canAssignCohort(pendingUser)){
	          // Defensive: if an education account reaches this modal, force unassigned and clear mapping.
	          if (cohortAPI){
	            cohortAPI.setUserCohort(pendingUser.email, null);
	          }
	          pendingUser.cohortLabel = '';
	          pendingUser.status = 'active';
	          pendingUser.date = new Date().toISOString().slice(0, 10);
	          assignModal?.hide();
	          updateTable();
	          return;
	        }
	        const programName = pendingUser.program || '';
	        const isNew = !!assignNew?.checked;
	        const isUnassigned = !!assignUnassigned?.checked;

        // Previous assignment
        const prevLabel = (pendingUser.cohortLabel || '').trim();
        let prevKey = 'unassigned';
        if (prevLabel && cohortAPI){
          const match = activeCohorts.find(c => c.cohortLabel === prevLabel);
          prevKey = match?.custom ? match.cohortId : cohortAPI.seedKeyForLabel(prevLabel);
        }

        // New assignment
        let newKey = 'unassigned';
        let newLabel = '';
        let newEntry = { type: 'unassigned' };

        if (isUnassigned){
          newKey = 'unassigned';
          newLabel = '';
          newEntry = { type: 'unassigned' };
        }else if (isNew){
          const name = (newCohortName?.value || '').trim();
          if (!name){
            setAssignError('Enter a cohort name.');
            return;
          }
          const created = createCustomCohort(programName, name);
          if (!created){
            setAssignError('Unable to create cohort. Please try again.');
            return;
          }
          newKey = created.record.id;
          newLabel = created.cohortLabel;
          newEntry = { type: 'custom', cohortId: created.record.id };
        }else{
          const selection = assignCohortSelect?.value || '';
          const selectedLabel = (assignCohortSelect?.selectedOptions?.[0]?.textContent || '').trim();
          if (!selection || !selectedLabel){
            setAssignError('Select a cohort.');
            return;
          }
          newLabel = selectedLabel;
          if (selection.startsWith('custom:')){
            newKey = selection.slice('custom:'.length);
            newEntry = { type: 'custom', cohortId: newKey };
          }else{
            newKey = cohortAPI ? cohortAPI.seedKeyForLabel(newLabel) : `seed:${newLabel}`;
            newEntry = { type: 'seed', label: newLabel };
          }
        }

        if (cohortAPI && prevKey !== newKey){
          cohortAPI.bumpMembership(prevKey, -1);
          cohortAPI.bumpMembership(newKey, 1);
        }
        if (cohortAPI){
          cohortAPI.setUserCohort(pendingUser.email, newEntry);
        }
        pendingUser.cohortLabel = newLabel;

        pendingUser.status = 'active';
        pendingUser.date = new Date().toISOString().slice(0, 10);
        assignModal?.hide();

        // Rebuild cohort filter options so the new custom cohort can be selected immediately.
        if (cohortFilter){
          const opts = ['', '__unassigned__'];
          activeCohorts.forEach(c => opts.push(c.cohortLabel));
          const unique = Array.from(new Set(opts));
          cohortFilter.innerHTML = unique.map(val => {
            if (!val) return `<option value="">All cohorts</option>`;
            if (val === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
            return `<option value="${val}">${val}</option>`;
          }).join('');
        }

        updateTable();
      });

      updateTable();
    })();
  
