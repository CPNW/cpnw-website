
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
        { id: 'rad', name: 'Radiologic Technology', base: 6, aySpan: 2 }
      ];

      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;
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
        return '';
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
      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];
      const demoMatch = currentUser?.email
        ? demoPeople.find(p => p.email.toLowerCase() === currentUser.email.toLowerCase())
        : null;
      const fallbackPrograms = Array.isArray(demoMatch?.programs) ? demoMatch.programs : [];
      const programsForScope = currentPrograms.length ? currentPrograms : fallbackPrograms;
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

        metricApproved.textContent = totals.approved;
        metricApprovedNote.textContent = totalPrograms ? `Across ${totalPrograms} program(s)` : 'Select a program';

        metricPending.textContent = totals.pending;
        metricPendingNote.textContent = totalPrograms ? `Students needing review` : '';

        metricActive.textContent = totals.students;
        metricActiveNote.textContent = totalPrograms ? `Across ${totalPrograms} program(s)` : 'Select a program';

        metricExpiringStudents.textContent = totals.expiringStudents;
        metricExpiringStudentsNote.textContent = totalPrograms ? `Across ${totalPrograms} program(s)` : 'Select a program';

        if (cohortCount){
          cohortCount.textContent = selectedCohorts.length ? cohortCountSelected : activeCohorts.length || 'All';
        }

        const listForCard = showArchived ? visibleCohorts : cohortsForTotals;
        renderCohorts(listForCard);
        renderReadiness(cohortsForTotals);
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

      function renderReadiness(list){
        if (!readinessTableBody) return;
        readinessTableBody.innerHTML = '';
        const rows = (list || []).map(c => {
          return `
            <tr>
              <td class="fw-semibold">${c.label}</td>
              <td>${c.students}</td>
              <td><span class="text-success fw-semibold">${c.approvedAssignments}</span></td>
              <td>${c.requirementsReview}</td>
              <td>${c.expiringStudents}</td>
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
  

