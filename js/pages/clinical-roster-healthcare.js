(function(){
  const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
  const ASSIGNMENT_WINDOW_DAYS = 42;
  const ASSIGNMENT_GRACE_DAYS = 14;
  const TODAY = new Date();

  const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
    ? window.CPNW.getCurrentUser()
    : (() => {
      try{
        return JSON.parse(localStorage.getItem('cpnw-current-user') || 'null');
      }catch{
        return null;
      }
    })();

  const roster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
    ? window.CPNW.getSharedRoster()
    : [];
  const requirementsStore = window.CPNW && window.CPNW.requirementsStore ? window.CPNW.requirementsStore : null;

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
  const HEALTHCARE_REQUIREMENTS = Array.from({ length: 6 }, (_, idx) => `Healthcare Req ${idx + 1}`);
  const APPROVED_STATUSES = new Set(['approved', 'conditionally approved']);

  const locationFilter = document.getElementById('locationFilter');
  const programFilter = document.getElementById('programFilter');
  const cohortFilter = document.getElementById('cohortFilter');
  const startDateFilter = document.getElementById('startDateFilter');
  const rosterSearch = document.getElementById('rosterSearch');
  const showAllBtn = document.getElementById('showAll');
  const showSelectedBtn = document.getElementById('showSelected');
  const approveSelectedBtn = document.getElementById('approveSelected');
  const tableBody = document.getElementById('clinicalRosterBody');
  const selectAll = document.getElementById('selectAllRoster');
  const pageSizeSelect = document.getElementById('pageSize');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');
  const sortButtons = document.querySelectorAll('.sort');
  const rejectModalEl = document.getElementById('rejectAssignmentModal');
  const rejectModal = rejectModalEl ? new bootstrap.Modal(rejectModalEl) : null;
  const rejectReasonInput = document.getElementById('rejectReasonInput');
  const rejectReasonError = document.getElementById('rejectReasonError');
  const confirmRejectBtn = document.getElementById('confirmRejectAssignment');
  const rejectModalSub = document.getElementById('rejectAssignmentModalSub');
  const approveWarningModalEl = document.getElementById('approveWarningModal');
  const approveWarningModal = approveWarningModalEl ? new bootstrap.Modal(approveWarningModalEl) : null;
  const approveWarningList = document.getElementById('approveWarningList');
  const approveAnywayBtn = document.getElementById('approveAnywayBtn');

  let showOnlySelected = false;
  let currentPage = 1;
  let pageSize = Number(pageSizeSelect?.value || 10);
  let sortState = { field: 'start', dir: 'asc' };
  const selectedIds = new Set();
  let pendingRejectId = '';
  let pendingApproveIds = [];

  function normalize(value){
    return String(value || '').trim().toLowerCase();
  }

  function fmtDate(date){
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  }

  function formatName(name){
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return name || '—';
    const first = parts.shift();
    const last = parts.pop();
    const middle = parts.length ? ` ${parts.join(' ')}` : '';
    return `${last}, ${first}${middle}`;
  }

  function formatRole(role){
    const norm = String(role || '').toLowerCase();
    if (norm === 'faculty-admin') return 'Faculty Admin';
    if (norm === 'faculty') return 'Faculty';
    return 'Student';
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

  function saveAssignments(list){
    try{
      const serialized = (Array.isArray(list) ? list : []).map(item => ({
        ...item,
        start: item.start instanceof Date ? item.start.toISOString() : item.start,
        end: item.end instanceof Date ? item.end.toISOString() : item.end
      }));
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(serialized));
    }catch{
      // ignore
    }
  }

  function stringSeed(value){
    return Array.from(String(value || '')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  }

  function seedAssignmentsFromRoster(list){
    const locations = ['CPNW Medical Center','CPNW Healthcare Facility','Evergreen Health','Providence NW'];
    const statusPool = ['approved','pending','rejected'];
    const assignments = [];
    list.forEach((person, idx) => {
      if (!person) return;
      if (!['student','faculty','faculty-admin'].includes(String(person.role || '').toLowerCase())) return;
      const key = person.studentId || person.sid || person.email || `demo-${idx + 1}`;
      const seed = stringSeed(key);
      const hasCurrentUpcoming = (seed % 5) !== 0;
      const hasPast = (seed % 3) !== 0;
      const location = locations[seed % locations.length];

      if (hasPast){
        const startPast = new Date(TODAY);
        startPast.setDate(startPast.getDate() - (90 + (seed % 60)));
        const endPast = new Date(startPast);
        endPast.setDate(endPast.getDate() + 60);
        assignments.push({
          id: `a-past-${key}`,
          studentId: person.studentId || '',
          studentSid: person.sid || '',
          location,
          start: startPast,
          end: endPast,
          status: statusPool[(seed + 1) % statusPool.length]
        });
      }

      if (hasCurrentUpcoming){
        const start = new Date(TODAY);
        start.setDate(start.getDate() + (seed % 45));
        const end = new Date(start);
        end.setDate(end.getDate() + 90);
        assignments.push({
          id: `a-cur-${key}`,
          studentId: person.studentId || '',
          studentSid: person.sid || '',
          location,
          start,
          end,
          status: statusPool[seed % statusPool.length]
        });
      }
    });
    return assignments;
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

  function findPerson(assignment){
    const sid = assignment?.studentSid || '';
    const studentId = assignment?.studentId || '';
    if (window.CPNW && typeof window.CPNW.findRosterEntry === 'function'){
      return window.CPNW.findRosterEntry({ sid, studentId }) || null;
    }
    return roster.find(person => {
      if (sid && String(person.sid || '') === String(sid)) return true;
      if (studentId && String(person.studentId || '') === String(studentId)) return true;
      return false;
    }) || null;
  }

  function statusBadge(status){
    const norm = String(status || 'pending').toLowerCase();
    if (norm === 'approved') return '<span class="badge text-bg-success">Approved</span>';
    if (norm === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
    return '<span class="badge text-bg-secondary">Pending</span>';
  }

  function requirementStatus(person, name, category, isElearning){
    if (!requirementsStore) return '';
    return requirementsStore.getStatus(
      { sid: person.sid || '', email: person.email || '' },
      name,
      { category, isElearning }
    );
  }

  function isApprovedStatus(status, isElearning){
    const norm = String(status || '').toLowerCase();
    if (isElearning) return norm === 'approved';
    return APPROVED_STATUSES.has(norm);
  }

  function listMissingRequirements(person){
    if (!person) return [];
    const missing = [];
    CPNW_ELEARNING.forEach(name => {
      const status = requirementStatus(person, name, 'CPNW Clinical Passport', true);
      if (!isApprovedStatus(status, true)){
        missing.push({ name, status: status || 'Not Submitted' });
      }
    });
    CPNW_REQUIREMENTS.forEach(name => {
      const status = requirementStatus(person, name, 'CPNW Clinical Passport', false);
      if (!isApprovedStatus(status, false)){
        missing.push({ name, status: status || 'Not Submitted' });
      }
    });
    HEALTHCARE_REQUIREMENTS.forEach(name => {
      const status = requirementStatus(person, name, 'Healthcare', false);
      if (!isApprovedStatus(status, false)){
        missing.push({ name, status: status || 'Not Submitted' });
      }
    });
    return missing;
  }

  function buildRows(){
    const facilityNames = getHealthcareFacilityNames();
    return assignments
      .filter(a => assignmentMatchesFacility(a, facilityNames))
      .filter(assignmentWithinWindow)
      .map((assignment, idx) => {
        const person = findPerson(assignment) || {};
        const school = person.school || person.schools?.[0] || person.profile?.school || '—';
        const program = person.program || person.programs?.[0] || person.profile?.program || '—';
        const cohortOverride = window.CPNW?.cohorts?.getUserCohortLabel
          ? window.CPNW.cohorts.getUserCohortLabel(person.email)
          : null;
        const cohort = (cohortOverride && cohortOverride.label)
          ? cohortOverride.label
          : (person.cohort || person.profile?.cohort || '');
        const sid = person.sid || person.profile?.sid || '';
        const email = person.email || person.profile?.email || '';
        const studentId = person.studentId || person.profile?.studentId || '';
        const role = formatRole(person.role || 'student');
        const name = formatName(person.name || `Student ${idx + 1}`);
        const status = String(assignment.status || 'pending').toLowerCase();
        const id = String(assignment.id || `${assignment.studentId || assignment.studentSid || 'unknown'}-${assignment.start?.toISOString?.() || idx}`);
        return {
          id,
          assignmentId: String(assignment.id || ''),
          name,
          rawName: person.name || name,
          location: assignment.location || '—',
          start: assignment.start,
          end: assignment.end,
          school,
          program,
          cohort,
          sid,
          email,
          studentId,
          type: role,
          status
        };
      });
  }

  let assignments = loadAssignments();
  let normalizedAssignments = false;
  assignments = assignments.map((assignment, idx) => {
    if (assignment.id && typeof assignment.id !== 'string'){
      normalizedAssignments = true;
      return { ...assignment, id: String(assignment.id) };
    }
    if (!assignment.id){
      normalizedAssignments = true;
      return {
        ...assignment,
        id: `a-auto-${assignment.studentId || assignment.studentSid || 'unknown'}-${idx}`
      };
    }
    return assignment;
  });
  if (!assignments.length && window.CPNW && typeof window.CPNW.getSharedRoster === 'function'){
    assignments = seedAssignmentsFromRoster(window.CPNW.getSharedRoster());
    normalizedAssignments = true;
  }
  if (normalizedAssignments){
    saveAssignments(assignments);
  }

  let rows = buildRows();
  const programFilterWrap = programFilter?.closest('[data-program-filter]');
  const programFilterMenu = programFilterWrap?.querySelector('[data-program-menu]');
  const cohortFilterWrap = cohortFilter?.closest('[data-cohort-filter]');
  const cohortFilterMenu = cohortFilterWrap?.querySelector('[data-cohort-menu]');

  function getProgramsBySchool(){
    return rows.reduce((acc, row) => {
      if (!row.school || !row.program || row.school === '—' || row.program === '—') return acc;
      acc[row.school] ||= [];
      acc[row.school].push(row.program);
      return acc;
    }, {});
  }

  const programFilterControl = (window.CPNW && typeof window.CPNW.buildProgramFilter === 'function')
    ? window.CPNW.buildProgramFilter({
      input: programFilter,
      menu: programFilterMenu,
      programsBySchool: getProgramsBySchool(),
      onChange: () => {
        currentPage = 1;
        updateCohortItems();
        renderRows();
      }
    })
    : null;

  const cohortFilterControl = (window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
    ? window.CPNW.buildCheckboxMultiSelect({
      input: cohortFilter,
      menu: cohortFilterMenu,
      placeholder: 'All cohorts',
      onChange: () => {
        currentPage = 1;
        renderRows();
      }
    })
    : null;

  function getCohortItems(programSelections = []){
    const hasProgramSelections = programSelections.length > 0;
    const filtered = rows.filter(row => {
      if (!hasProgramSelections) return true;
      return programSelections.some(sel =>
        normalize(sel.school) === normalize(row.school)
        && normalize(sel.program) === normalize(row.program)
      );
    });
    const items = [];
    const seen = new Set();
    items.push({ value: '__unassigned__', label: 'Unassigned', group: '' });
    filtered.forEach(row => {
      const label = row.cohort || '';
      if (!label || seen.has(label)) return;
      seen.add(label);
      items.push({ value: label, label, group: row.school || '' });
    });
    return items;
  }

  function updateCohortItems(){
    if (!cohortFilterControl) return;
    const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
    cohortFilterControl.setItems(getCohortItems(programSelections));
  }

  updateCohortItems();

  function populateFilters(){
    if (!locationFilter || !startDateFilter) return;
    const locations = new Set();
    const startDates = new Map();
    rows.forEach(row => {
      if (row.location && row.location !== '—') locations.add(row.location);
      if (row.start instanceof Date && !Number.isNaN(row.start.getTime())){
        const key = row.start.toISOString().slice(0, 10);
        startDates.set(key, fmtDate(row.start));
      }
    });
    locationFilter.innerHTML = ['<option value="">All locations</option>', ...Array.from(locations).sort().map(val => `<option value="${val}">${val}</option>`)].join('');
    const startOptions = Array.from(startDates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => `<option value="${value}">${label}</option>`);
    startDateFilter.innerHTML = ['<option value="">All start dates</option>', ...startOptions].join('');
  }

  function compareValues(a, b){
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (a instanceof Date && b instanceof Date) return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  function renderRows(){
    if (!tableBody) return;
    const q = normalize(rosterSearch?.value || '');
    const location = String(locationFilter?.value || '');
    const startDate = String(startDateFilter?.value || '');
    const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
    const hasProgramSelections = programSelections.length > 0;
    const cohortSelections = cohortFilterControl ? cohortFilterControl.getSelection() : [];
    const hasCohortSelections = cohortSelections.length > 0;
    const cohortSet = new Set(cohortSelections);

    let filtered = rows.filter(row => {
      if (location && row.location !== location) return false;
      if (startDate){
        const rowKey = row.start instanceof Date && !Number.isNaN(row.start.getTime())
          ? row.start.toISOString().slice(0, 10)
          : '';
        if (rowKey !== startDate) return false;
      }
      if (hasProgramSelections){
        const matchesProgram = programSelections.some(sel =>
          normalize(sel.school) === normalize(row.school)
          && normalize(sel.program) === normalize(row.program)
        );
        if (!matchesProgram) return false;
      }
      if (hasCohortSelections){
        const cohortLabel = String(row.cohort || '').trim();
        const wantsUnassigned = cohortSet.has('__unassigned__');
        if (!cohortLabel){
          if (!wantsUnassigned) return false;
        }else if (!cohortSet.has(cohortLabel)){
          return false;
        }
      }
      if (showOnlySelected && !selectedIds.has(row.id)) return false;
      if (q && !`${row.rawName} ${row.location} ${row.school} ${row.program} ${row.cohort}`.toLowerCase().includes(q)) return false;
      return true;
    });

    filtered = filtered.sort((a, b) => {
      const dir = sortState.dir === 'desc' ? -1 : 1;
      const field = sortState.field;
      const valA = field === 'start' ? a.start : field === 'end' ? a.end : (a[field] ?? '');
      const valB = field === 'start' ? b.start : field === 'end' ? b.end : (b[field] ?? '');
      const result = compareValues(valA, valB);
      return dir * result;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageItems = filtered.slice(startIdx, endIdx);

    tableBody.innerHTML = pageItems.map(row => {
      const isApproved = row.status === 'approved';
      const isRejected = row.status === 'rejected';
      let actions = '';
      if (isApproved){
        actions = `
          <button class="btn btn-outline-danger btn-cpnw btn-sm" type="button" data-action="reject" data-id="${row.id}">
            Reject
          </button>
        `;
      }else if (isRejected){
        actions = `
          <button class="btn btn-outline-success btn-cpnw btn-sm" type="button" data-action="approve" data-id="${row.id}">
            Approve
          </button>
        `;
      }else{
        actions = `
          <div class="btn-group btn-group-sm" role="group" aria-label="Assignment actions">
            <button class="btn btn-outline-success btn-cpnw" type="button" data-action="approve" data-id="${row.id}">Approve</button>
            <button class="btn btn-outline-danger btn-cpnw" type="button" data-action="reject" data-id="${row.id}">Reject</button>
          </div>
        `;
      }

      return `
        <tr>
          <td><input type="checkbox" class="form-check-input roster-row" data-id="${row.id}" ${selectedIds.has(row.id) ? 'checked' : ''}></td>
          <td class="fw-semibold">${row.name}</td>
          <td>${row.location}</td>
          <td>${fmtDate(row.start)}</td>
          <td>${fmtDate(row.end)}</td>
          <td>${row.school}</td>
          <td>${row.program}</td>
          <td>${row.cohort || '—'}</td>
          <td>${row.type}</td>
          <td>${statusBadge(row.status)}</td>
          <td class="text-end">${actions}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="11" class="text-body-secondary small">No clinical roster entries match the selected filters.</td></tr>';

    if (pageInfo){
      pageInfo.textContent = total ? `Showing ${startIdx + 1}–${endIdx} of ${total}` : 'No results';
    }
    if (prevPage && nextPage){
      prevPage.disabled = currentPage <= 1;
      nextPage.disabled = endIdx >= total;
    }
    if (selectAll){
      const pageIds = pageItems.map(row => row.id);
      selectAll.checked = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
      selectAll.indeterminate = pageIds.some(id => selectedIds.has(id)) && !selectAll.checked;
    }
  }

  function updateRows(){
    rows = buildRows();
    populateFilters();
    updateCohortItems();
    currentPage = 1;
    renderRows();
  }

  function applyApproval(ids){
    if (!ids.length) return;
    ids.forEach(id => {
      const assignment = assignments.find(item => String(item.id) === String(id));
      if (!assignment) return;
      assignment.status = 'approved';
      assignment.rejectionReason = '';
      assignment.rejectionAt = '';
    });
    saveAssignments(assignments);
    updateRows();
  }

  function renderApprovalWarnings(warnings){
    if (!approveWarningList) return;
    if (!warnings.length){
      approveWarningList.innerHTML = '<li class="list-group-item text-body-secondary small">All selected assignments are ready to approve.</li>';
      return;
    }
    approveWarningList.innerHTML = warnings.map(item => {
      const missingList = item.missing
        .map(req => `${req.name} (${req.status})`)
        .join(', ');
      const link = item.sid
        ? `<a class="btn btn-outline-secondary btn-sm btn-cpnw" href="review-healthcare.html?sid=${encodeURIComponent(item.sid)}" target="_blank" rel="noopener">View requirements</a>`
        : '';
      return `
        <li class="list-group-item">
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div>
              <div class="fw-semibold">${item.name}</div>
              <div class="small text-body-secondary">${missingList || 'Missing requirements'}</div>
            </div>
            ${link}
          </div>
        </li>
      `;
    }).join('');
  }

  function collectApprovalWarnings(ids){
    const warnings = [];
    ids.forEach(id => {
      const row = rows.find(item => item.id === id);
      if (!row) return;
      const person = {
        sid: row.sid || '',
        email: row.email || '',
        name: row.name
      };
      const missing = listMissingRequirements(person);
      if (missing.length){
        warnings.push({ id, name: row.name, sid: row.sid || '', missing });
      }
    });
    return warnings;
  }

  function handleApprove(ids){
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (!uniqueIds.length){
      alert('Select at least one assignment to approve.');
      return;
    }
    const warnings = collectApprovalWarnings(uniqueIds);
    if (warnings.length){
      pendingApproveIds = uniqueIds;
      renderApprovalWarnings(warnings);
      approveWarningModal?.show();
      return;
    }
    applyApproval(uniqueIds);
  }

  [locationFilter, startDateFilter].forEach(el => {
    el?.addEventListener('change', () => {
      currentPage = 1;
      renderRows();
    });
  });

  rosterSearch?.addEventListener('input', () => {
    currentPage = 1;
    renderRows();
  });

  showAllBtn?.addEventListener('click', () => {
    showOnlySelected = false;
    showAllBtn.classList.add('btn-cpnw','btn-cpnw-primary');
    showAllBtn.classList.remove('btn-outline-secondary');
    showSelectedBtn?.classList.add('btn-outline-secondary');
    showSelectedBtn?.classList.remove('btn-cpnw','btn-cpnw-primary');
    renderRows();
  });

  showSelectedBtn?.addEventListener('click', () => {
    showOnlySelected = true;
    showSelectedBtn.classList.add('btn-cpnw','btn-cpnw-primary');
    showSelectedBtn.classList.remove('btn-outline-secondary');
    showAllBtn?.classList.add('btn-outline-secondary');
    showAllBtn?.classList.remove('btn-cpnw','btn-cpnw-primary');
    renderRows();
  });

  approveSelectedBtn?.addEventListener('click', () => {
    handleApprove(Array.from(selectedIds));
  });

  tableBody?.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.roster-row');
    if (!checkbox) return;
    const id = checkbox.dataset.id;
    if (!id) return;
    if (checkbox.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    renderRows();
  });

  tableBody?.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const id = actionBtn.dataset.id;
    if (!id) return;
    const assignment = assignments.find(item => String(item.id) === id);
    if (!assignment) return;
    const action = actionBtn.dataset.action;
    if (action === 'approve'){
      handleApprove([id]);
      return;
    }
    if (action === 'reject'){
      pendingRejectId = id;
      const row = rows.find(item => item.id === id);
      if (rejectModalSub){
        const label = row ? `${row.name} • ${row.location}` : 'Let the student know what needs attention.';
        rejectModalSub.textContent = label;
      }
      if (rejectReasonInput) rejectReasonInput.value = assignment.rejectionReason || '';
      if (rejectReasonError){
        rejectReasonError.classList.add('d-none');
        rejectReasonError.textContent = '';
      }
      rejectModal?.show();
    }
  });

  approveAnywayBtn?.addEventListener('click', () => {
    if (!pendingApproveIds.length) return;
    applyApproval(pendingApproveIds);
    pendingApproveIds = [];
    approveWarningModal?.hide();
  });

  approveWarningModalEl?.addEventListener('hidden.bs.modal', () => {
    pendingApproveIds = [];
    if (approveWarningList){
      approveWarningList.innerHTML = '';
    }
  });

  confirmRejectBtn?.addEventListener('click', () => {
    if (!pendingRejectId) return;
    const assignment = assignments.find(item => item.id === pendingRejectId);
    if (!assignment) return;
    const reason = String(rejectReasonInput?.value || '').trim();
    if (!reason){
      if (rejectReasonError){
        rejectReasonError.textContent = 'Please provide a reason for the rejection.';
        rejectReasonError.classList.remove('d-none');
      }
      return;
    }
    assignment.status = 'rejected';
    assignment.rejectionReason = reason;
    assignment.rejectionAt = new Date().toISOString();
    saveAssignments(assignments);
    pendingRejectId = '';
    rejectModal?.hide();
    updateRows();
  });

  rejectModalEl?.addEventListener('hidden.bs.modal', () => {
    pendingRejectId = '';
    if (rejectReasonInput) rejectReasonInput.value = '';
    if (rejectReasonError){
      rejectReasonError.classList.add('d-none');
      rejectReasonError.textContent = '';
    }
    if (rejectModalSub){
      rejectModalSub.textContent = 'Let the student know what needs attention.';
    }
  });

  selectAll?.addEventListener('change', () => {
    if (!selectAll) return;
    const q = normalize(rosterSearch?.value || '');
    const location = String(locationFilter?.value || '');
    const startDate = String(startDateFilter?.value || '');
    const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
    const hasProgramSelections = programSelections.length > 0;
    const cohortSelections = cohortFilterControl ? cohortFilterControl.getSelection() : [];
    const hasCohortSelections = cohortSelections.length > 0;
    const cohortSet = new Set(cohortSelections);
    const pageItems = rows.filter(row => {
      if (location && row.location !== location) return false;
      if (startDate){
        const rowKey = row.start instanceof Date && !Number.isNaN(row.start.getTime())
          ? row.start.toISOString().slice(0, 10)
          : '';
        if (rowKey !== startDate) return false;
      }
      if (hasProgramSelections){
        const matchesProgram = programSelections.some(sel =>
          normalize(sel.school) === normalize(row.school)
          && normalize(sel.program) === normalize(row.program)
        );
        if (!matchesProgram) return false;
      }
      if (hasCohortSelections){
        const cohortLabel = String(row.cohort || '').trim();
        const wantsUnassigned = cohortSet.has('__unassigned__');
        if (!cohortLabel){
          if (!wantsUnassigned) return false;
        }else if (!cohortSet.has(cohortLabel)){
          return false;
        }
      }
      if (showOnlySelected && !selectedIds.has(row.id)) return false;
      if (q && !`${row.rawName} ${row.location} ${row.school} ${row.program} ${row.cohort}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const totalPages = Math.max(1, Math.ceil(pageItems.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, pageItems.length);
    const visible = pageItems.slice(startIdx, endIdx);
    visible.forEach(row => {
      if (selectAll.checked) selectedIds.add(row.id);
      else selectedIds.delete(row.id);
    });
    renderRows();
  });

  pageSizeSelect?.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value || 10);
    currentPage = 1;
    renderRows();
  });

  prevPage?.addEventListener('click', () => {
    if (currentPage > 1){
      currentPage -= 1;
      renderRows();
    }
  });

  nextPage?.addEventListener('click', () => {
    currentPage += 1;
    renderRows();
  });

  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (!field) return;
      if (sortState.field === field){
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      }else{
        sortState = { field, dir: 'asc' };
      }
      renderRows();
    });
  });

  updateRows();
})();
