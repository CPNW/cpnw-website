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
  const schoolFilter = document.getElementById('schoolFilter');
  const programFilter = document.getElementById('programFilter');
  const cohortFilter = document.getElementById('cohortFilter');
  const startDateFilter = document.getElementById('startDateFilter');
  const statusFilterButtons = document.querySelectorAll('[data-status-filter]');
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
  const statusFilterNote = document.getElementById('statusFilterNote');

  let showOnlySelected = false;
  let currentPage = 1;
  let pageSize = Number(pageSizeSelect?.value || 10);
  let sortState = { field: 'start', dir: 'asc' };
  const selectedIds = new Set();
  let pendingRejectId = '';
  let pendingApproveIds = [];
  const statusParam = new URLSearchParams(window.location.search || '').get('status');
  const statusParamValue = statusParam ? String(statusParam).trim().toLowerCase() : '';
  const allowedStatusFilters = new Set(['approved', 'pending', 'rejected']);
  let effectiveStatusFilter = allowedStatusFilters.has(statusParamValue) ? statusParamValue : '';

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
    if (name.includes('bsn')) return 'bsn';
    if (name.includes('adn')) return 'adn';
    return name;
  }

  function formatProgramLabel(value){
    const token = normalizeProgramToken(value);
    if (token.includes('surg')) return 'Surg Tech';
    if (token.includes('rad')) return 'Radiologic Technology';
    if (token.includes('resp')) return 'Respiratory Care';
    if (token.includes('sonography')) return 'Diagnostic Medical Sonography';
    if (token.includes('medicalassistant')) return 'Medical Assistant';
    if (token.includes('bsn')) return 'BSN';
    if (token.includes('adn')) return 'ADN';
    return String(value || '').trim();
  }

  function updateStatusFilterNote(){
    if (!statusFilterNote) return;
    if (!effectiveStatusFilter){
      statusFilterNote.textContent = '';
      return;
    }
    const label = effectiveStatusFilter.charAt(0).toUpperCase() + effectiveStatusFilter.slice(1);
    statusFilterNote.textContent = `Filtered: ${label} assignments`;
  }

  function updateStatusFilterButtons(){
    if (!statusFilterButtons.length) return;
    statusFilterButtons.forEach(btn => {
      const value = String(btn.dataset.statusFilter || '');
      const isActive = (!value && !effectiveStatusFilter) || value === effectiveStatusFilter;
      btn.classList.toggle('btn-cpnw', isActive);
      btn.classList.toggle('btn-cpnw-primary', isActive);
      btn.classList.toggle('btn-outline-secondary', !isActive);
    });
  }

  function applyStatusFilter(value){
    effectiveStatusFilter = allowedStatusFilters.has(value) ? value : '';
    updateStatusFilterNote();
    updateStatusFilterButtons();
    currentPage = 1;
    renderRows();
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
      const programValue = person.program || person.programs?.[0] || person.profile?.program || '';
      const programKey = normalizeProgramToken(programValue);
      const forceFacility = ['radtech','respcare','medicalassistant','sonography'].includes(programKey);
      const hasCurrentUpcoming = (seed % 5) !== 0 || forceFacility;
      const hasPast = (seed % 3) !== 0;
      const location = forceFacility ? 'CPNW Healthcare Facility' : locations[seed % locations.length];

      if (hasPast){
        const startPast = new Date(TODAY);
        startPast.setDate(startPast.getDate() - (90 + (seed % 60)));
        const endPast = new Date(startPast);
        endPast.setDate(endPast.getDate() + 60);
        assignments.push({
          id: `a-past-${key}`,
          studentId: person.studentId || '',
          studentSid: person.sid || '',
          studentEmail: person.email || '',
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
          studentEmail: person.email || '',
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
    const email = assignment?.studentEmail || assignment?.studentEmailAddress || '';
    if (window.CPNW && typeof window.CPNW.findRosterEntry === 'function'){
      return window.CPNW.findRosterEntry({ sid, studentId, email }) || null;
    }
    return roster.find(person => {
      if (sid && String(person.sid || '') === String(sid)) return true;
      if (studentId && String(person.studentId || '') === String(studentId)) return true;
      if (email && String(person.email || '').toLowerCase() === String(email).toLowerCase()) return true;
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
        const rawProgram = person.program || person.programs?.[0] || person.profile?.program || '—';
        const program = rawProgram && rawProgram !== '—' ? formatProgramLabel(rawProgram) : '—';
        const cohortOverride = window.CPNW?.cohorts?.getUserCohortLabel
          ? window.CPNW.cohorts.getUserCohortLabel(person.email)
          : null;
        const cohort = (typeof cohortOverride === 'string' && cohortOverride.trim())
          ? cohortOverride.trim()
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
  function assignmentStudentKey(item){
    if (!item) return '';
    const id = String(item.studentId || '').trim();
    if (id) return id;
    const sid = String(item.studentSid || '').trim();
    if (sid) return sid;
    const email = String(item.studentEmail || item.studentEmailAddress || '').trim().toLowerCase();
    return email;
  }
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
  if (window.CPNW && typeof window.CPNW.getSharedRoster === 'function'){
    const rosterList = window.CPNW.getSharedRoster();
    if (!assignments.length){
      assignments = seedAssignmentsFromRoster(rosterList);
      normalizedAssignments = true;
    }else{
      const facilityNames = getHealthcareFacilityNames();
      const existingByKey = new Map();
      assignments.forEach(item => {
        const key = assignmentStudentKey(item);
        if (!key) return;
        if (!existingByKey.has(key)) existingByKey.set(key, []);
        existingByKey.get(key).push(item);
      });
      const seeded = seedAssignmentsFromRoster(rosterList);
      const additions = seeded.filter(item => {
        const key = assignmentStudentKey(item);
        if (!key) return false;
        const existing = existingByKey.get(key) || [];
        if (!existing.length) return true;
        if (!facilityNames.size) return false;
        const hasFacilityAssignment = existing.some(entry => assignmentMatchesFacility(entry, facilityNames));
        return !hasFacilityAssignment;
      });
      if (additions.length){
        assignments.push(...additions);
        normalizedAssignments = true;
      }
    }
  }
  if (normalizedAssignments){
    saveAssignments(assignments);
  }

  let rows = buildRows();
  const schoolFilterWrap = schoolFilter?.closest('[data-school-filter]');
  const schoolFilterMenu = schoolFilterWrap?.querySelector('[data-school-menu]');
  const programFilterWrap = programFilter?.closest('[data-program-filter]');
  const programFilterMenu = programFilterWrap?.querySelector('[data-program-menu]');
  const cohortFilterWrap = cohortFilter?.closest('[data-cohort-filter]');
  const cohortFilterMenu = cohortFilterWrap?.querySelector('[data-cohort-menu]');
  const startDateFilterWrap = startDateFilter?.closest('[data-start-date-filter]');
  const startDateFilterMenu = startDateFilterWrap?.querySelector('[data-start-date-menu]');
  const buildMultiSelect = (window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
    ? window.CPNW.buildCheckboxMultiSelect
    : null;
  let schoolFilterControl = null;
  let programFilterControl = null;
  let cohortFilterControl = null;
  let startDateFilterControl = null;

  function ensureFilterControls(){
    if (!buildMultiSelect) return;
    if (!schoolFilterControl && schoolFilter && schoolFilterMenu){
      schoolFilterControl = buildMultiSelect({
        input: schoolFilter,
        menu: schoolFilterMenu,
        items: [],
        placeholder: 'All schools',
        onChange: handleFilterChange
      });
    }
    if (!programFilterControl && programFilter && programFilterMenu){
      programFilterControl = buildMultiSelect({
        input: programFilter,
        menu: programFilterMenu,
        items: [],
        placeholder: 'All programs',
        onChange: handleFilterChange
      });
    }
    if (!cohortFilterControl && cohortFilter && cohortFilterMenu){
      cohortFilterControl = buildMultiSelect({
        input: cohortFilter,
        menu: cohortFilterMenu,
        items: [],
        placeholder: 'All cohorts',
        onChange: handleFilterChange
      });
    }
    if (!startDateFilterControl && startDateFilter && startDateFilterMenu){
      startDateFilterControl = buildMultiSelect({
        input: startDateFilter,
        menu: startDateFilterMenu,
        items: [],
        placeholder: 'All start dates',
        onChange: handleFilterChange
      });
    }
  }

  function buildSchoolItems(){
    const map = new Map();
    rows.forEach(row => {
      const label = String(row.school || '').trim();
      if (!label || label === '—') return;
      const value = normalize(label);
      if (!map.has(value)) map.set(value, label);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }

  function buildProgramItems(list){
    const map = new Map();
    list.forEach(row => {
      const label = String(row.program || '').trim();
      if (!label || label === '—') return;
      const value = normalizeProgramToken(label);
      if (!value) return;
      if (!map.has(value)) map.set(value, label);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }

  function buildCohortItems(list){
    const map = new Map();
    list.forEach(row => {
      const raw = String(row.cohort || '').trim();
      const value = raw ? normalize(raw) : '__unassigned__';
      if (map.has(value)) return;
      const label = raw || 'Unassigned';
      const group = row.program && row.program !== '—' ? row.program : 'Other';
      map.set(value, { value, label, group });
    });
    return Array.from(map.values())
      .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  }

  function buildStartDateItems(list){
    const startDates = new Map();
    list.forEach(row => {
      if (!(row.start instanceof Date) || Number.isNaN(row.start.getTime())) return;
      const key = row.start.toISOString().slice(0, 10);
      startDates.set(key, fmtDate(row.start));
    });
    return Array.from(startDates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }

  function updateFilterItems(){
    ensureFilterControls();
    if (!schoolFilterControl || !programFilterControl || !cohortFilterControl) return;
    schoolFilterControl.setItems(buildSchoolItems());
    const schoolSelections = new Set(schoolFilterControl.getSelection());
    const schoolFiltered = schoolSelections.size
      ? rows.filter(row => schoolSelections.has(normalize(row.school)))
      : rows;

    programFilterControl.setItems(buildProgramItems(schoolFiltered));
    const programSelections = new Set(programFilterControl.getSelection());
    const programFiltered = programSelections.size
      ? schoolFiltered.filter(row => programSelections.has(normalizeProgramToken(row.program)))
      : schoolFiltered;

    cohortFilterControl.setItems(buildCohortItems(programFiltered));
    const cohortSelections = new Set(cohortFilterControl.getSelection());
    const cohortFiltered = cohortSelections.size
      ? programFiltered.filter(row => {
        const cohortKey = row.cohort ? normalize(row.cohort) : '__unassigned__';
        return cohortSelections.has(cohortKey);
      })
      : programFiltered;

    if (startDateFilterControl){
      startDateFilterControl.setItems(buildStartDateItems(cohortFiltered));
    }
  }

  function handleFilterChange(){
    updateFilterItems();
    currentPage = 1;
    renderRows();
  }

  ensureFilterControls();
  updateFilterItems();
  updateStatusFilterButtons();

  function populateFilters(){
    if (!locationFilter) return;
    const locations = new Set();
    rows.forEach(row => {
      if (row.location && row.location !== '—') locations.add(row.location);
    });
    locationFilter.innerHTML = ['<option value="">All locations</option>', ...Array.from(locations).sort().map(val => `<option value="${val}">${val}</option>`)].join('');
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
    updateStatusFilterNote();
    const q = normalize(rosterSearch?.value || '');
    const location = String(locationFilter?.value || '');
    const startDateSelections = startDateFilterControl
      ? startDateFilterControl.getSelection()
      : (startDateFilter?.value ? [startDateFilter.value] : []);
    const startDateSet = new Set(startDateSelections);
    const hasStartDateSelection = startDateSet.size > 0;
    const schoolSelections = schoolFilterControl ? schoolFilterControl.getSelection() : [];
    const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
    const cohortSelections = cohortFilterControl ? cohortFilterControl.getSelection() : [];
    const schoolSet = new Set(schoolSelections.map(normalize));
    const programSet = new Set(programSelections.map(normalizeProgramToken));
    const cohortSet = new Set(cohortSelections.map(val => (val === '__unassigned__' ? '__unassigned__' : normalize(val))));
    const hasSchoolSelection = schoolSet.size > 0;
    const hasProgramSelection = programSet.size > 0;
    const hasCohortSelection = cohortSet.size > 0;

    let filtered = rows.filter(row => {
      if (location && row.location !== location) return false;
      if (hasStartDateSelection){
        const rowKey = row.start instanceof Date && !Number.isNaN(row.start.getTime())
          ? row.start.toISOString().slice(0, 10)
          : '';
        if (!startDateSet.has(rowKey)) return false;
      }
      if (effectiveStatusFilter && row.status !== effectiveStatusFilter) return false;
      if (hasSchoolSelection && !schoolSet.has(normalize(row.school))) return false;
      if (hasProgramSelection && !programSet.has(normalizeProgramToken(row.program))) return false;
      if (hasCohortSelection){
        const cohortKey = row.cohort ? normalize(row.cohort) : '__unassigned__';
        if (!cohortSet.has(cohortKey)) return false;
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
    updateFilterItems();
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

  locationFilter?.addEventListener('change', () => {
    currentPage = 1;
    renderRows();
  });

  statusFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      applyStatusFilter(String(btn.dataset.statusFilter || ''));
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
    const startDateSelections = startDateFilterControl
      ? startDateFilterControl.getSelection()
      : (startDateFilter?.value ? [startDateFilter.value] : []);
    const startDateSet = new Set(startDateSelections);
    const hasStartDateSelection = startDateSet.size > 0;
    const schoolSelections = schoolFilterControl ? schoolFilterControl.getSelection() : [];
    const programSelections = programFilterControl ? programFilterControl.getSelection() : [];
    const cohortSelections = cohortFilterControl ? cohortFilterControl.getSelection() : [];
    const schoolSet = new Set(schoolSelections.map(normalize));
    const programSet = new Set(programSelections.map(normalizeProgramToken));
    const cohortSet = new Set(cohortSelections.map(val => (val === '__unassigned__' ? '__unassigned__' : normalize(val))));
    const hasSchoolSelection = schoolSet.size > 0;
    const hasProgramSelection = programSet.size > 0;
    const hasCohortSelection = cohortSet.size > 0;
    const pageItems = rows.filter(row => {
      if (location && row.location !== location) return false;
      if (hasStartDateSelection){
        const rowKey = row.start instanceof Date && !Number.isNaN(row.start.getTime())
          ? row.start.toISOString().slice(0, 10)
          : '';
        if (!startDateSet.has(rowKey)) return false;
      }
      if (effectiveStatusFilter && row.status !== effectiveStatusFilter) return false;
      if (hasSchoolSelection && !schoolSet.has(normalize(row.school))) return false;
      if (hasProgramSelection && !programSet.has(normalizeProgramToken(row.program))) return false;
      if (hasCohortSelection){
        const cohortKey = row.cohort ? normalize(row.cohort) : '__unassigned__';
        if (!cohortSet.has(cohortKey)) return false;
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
