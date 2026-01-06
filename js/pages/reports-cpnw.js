(function(){
  const tableBody = document.getElementById('reportTableBody');
  const entryInfo = document.getElementById('reportEntryInfo');
  const pager = document.getElementById('reportPager');
  const pageSizeSelect = document.getElementById('reportPageSize');
  const reportSearch = document.getElementById('reportSearch');
  const reportSchool = document.getElementById('reportSchool');
  const reportProgram = document.getElementById('reportProgram');
  const reportMonth = document.getElementById('reportMonth');
  const reportStart = document.getElementById('reportStart');
  const reportEnd = document.getElementById('reportEnd');
  const reportApply = document.getElementById('reportApply');
  const reportReset = document.getElementById('reportReset');
  const reportExport = document.getElementById('reportExport');
  const rangeMonth = document.getElementById('reportRangeMonth');
  const rangeCustom = document.getElementById('reportRangeCustom');
  const sortButtons = document.querySelectorAll('.sort');

  const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];

  const WATCH_PROGRAMS = [
    { school: 'CPNW University', program: 'ADN', watchRequirement: 'CPNW: CPNW WATCH' },
    { school: 'CPNW Education', program: 'BSN', watchRequirement: 'CPNW: Independent WATCH' },
    { school: 'CPNW University', program: 'BSN', watchRequirement: 'CPNW: Independent WATCH' },
    { school: 'CPNW Education', program: 'Radiologic Technology', watchRequirement: 'CPNW: CPNW WATCH' },
    { school: 'CPNW University', program: 'Respiratory Care', watchRequirement: 'CPNW: CPNW WATCH' },
    { school: 'CPNW Education', program: 'Medical Assistant', watchRequirement: 'CPNW: Independent WATCH' },
    { school: 'CPNW Education', program: 'Diagnostic Medical Sonography', watchRequirement: 'CPNW: CPNW WATCH' }
  ];
  function normalizeProgramName(name){
    const normalized = String(name || '').toLowerCase();
    if (normalized.includes('surg')) return 'Surg Tech';
    if (normalized.includes('rad')) return 'Radiologic Technology';
    if (normalized.includes('resp')) return 'Respiratory Care';
    if (normalized.includes('medassistant') || normalized.includes('medassist')) return 'Medical Assistant';
    if (normalized.includes('sonography') || normalized.includes('sono') || normalized.includes('dms')) return 'Diagnostic Medical Sonography';
    if (normalized.includes('bsn')) return 'BSN';
    if (normalized.includes('adn')) return 'ADN';
    return String(name || '').trim();
  }
  const WATCH_PROGRAM_KEYS = new Map(WATCH_PROGRAMS.map(p => [`${p.school}::${normalizeProgramName(p.program)}`, p]));

  const REPORT_RUNS_KEY = 'cpnw-watch-report-runs-v1';
  let reportRunsCache = loadJSON(REPORT_RUNS_KEY, {});

  let currentPage = 1;
  let pageSize = Number(pageSizeSelect?.value || 10);
  let sortState = { field: 'date', dir: 'desc' };
  let rows = [];

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
    }catch{}
  }

  function getDecision(email, reqName){
    const store = loadJSON('cpnw-reviewer-decisions-v1', {});
    return store[`${email}|${reqName}`.toLowerCase()] || null;
  }

  function resolveProgram(person){
    const program = person.programs?.[0] || person.profile?.program || '';
    const school = person.schools?.[0] || person.profile?.school || '';
    return { program, school };
  }

  function parseName(name){
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: 'Student', last: '', middle: '' };
    if (parts.length === 1) return { first: parts[0], last: '', middle: '' };
    if (parts.length === 2) return { first: parts[0], last: parts[1], middle: '' };
    return { first: parts[0], middle: parts[1], last: parts.slice(2).join(' ') };
  }

  function seedRunDate(key){
    const seed = Array.from(String(key)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    if (seed % 3 !== 0) return null;
    const now = new Date();
    const year = now.getFullYear();
    const novemberStart = new Date(year, 10, 1, 0, 0, 0);
    const decemberStart = new Date(year, 11, 1, 0, 0, 0);
    const decemberEnd = new Date(year, 11, now.getDate(), 23, 59, 59);
    const bucket = seed % 2 === 0 ? { start: novemberStart, end: new Date(year, 10, 30, 23, 59, 59) } : { start: decemberStart, end: decemberEnd };
    const rangeDays = Math.max(1, Math.floor((bucket.end.getTime() - bucket.start.getTime()) / 86400000) + 1);
    const dayOffset = seed % rangeDays;
    const date = new Date(bucket.start.getTime() + dayOffset * 86400000);
    date.setHours((seed % 12) + 8, seed % 60, 0, 0);
    return date.toISOString();
  }

  function getRunDate(email, reqName){
    const key = `${email}|${reqName}`.toLowerCase();
    const decision = getDecision(email, reqName);
    if (decision?.at) return decision.at;
    if (reportRunsCache[key]) return reportRunsCache[key];
    const seeded = seedRunDate(key);
    if (seeded){
      reportRunsCache[key] = seeded;
      saveJSON(REPORT_RUNS_KEY, reportRunsCache);
      return seeded;
    }
    return null;
  }

  function fmtDate(d){
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  }

  function buildRows(){
    return roster.map((person) => {
      const { program, school } = resolveProgram(person);
      const watchProgram = WATCH_PROGRAM_KEYS.get(`${school}::${normalizeProgramName(program)}`);
      if (!watchProgram) return null;
      const runDateRaw = getRunDate(person.email, watchProgram.watchRequirement);
      if (!runDateRaw) return null;
      const runDate = new Date(runDateRaw);
      const nameParts = parseName(person.name);
      return {
        id: `${person.email}|${watchProgram.watchRequirement}`,
        date: runDate,
        username: person.profile?.emailUsername || person.email,
        name: `${nameParts.last}, ${nameParts.first}`.trim().replace(/^,\s*/, ''),
        school,
        program
      };
    }).filter(Boolean).sort((a,b) => b.date - a.date);
  }

  function setDefaultMonth(){
    if (!reportMonth) return;
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    reportMonth.value = `${now.getFullYear()}-${month}`;
  }

  function applyRangeMode(){
    if (!rangeMonth || !rangeCustom) return;
    const isCustom = rangeCustom.checked;
    if (reportMonth) reportMonth.disabled = isCustom;
    if (reportStart) reportStart.disabled = !isCustom;
    if (reportEnd) reportEnd.disabled = !isCustom;
  }

  function dateRangeFromFilters(){
    if (rangeCustom?.checked){
      const start = reportStart?.value ? new Date(`${reportStart.value}T00:00:00`) : null;
      const end = reportEnd?.value ? new Date(`${reportEnd.value}T23:59:59`) : null;
      return { start, end };
    }
    const value = reportMonth?.value;
    if (!value) return { start: null, end: null };
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return { start: null, end: null };
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59);
    return { start, end };
  }

  function applyFilters(){
    const search = String(reportSearch?.value || '').trim().toLowerCase();
    const school = String(reportSchool?.value || '');
    const program = String(reportProgram?.value || '');
    const { start, end } = dateRangeFromFilters();

    let filtered = rows.filter((row) => {
      if (school && row.school !== school) return false;
      if (program && row.program !== program) return false;
      if (search && !`${row.username} ${row.name}`.toLowerCase().includes(search)) return false;
      if (start && row.date < start) return false;
      if (end && row.date > end) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const field = sortState.field;
      const dir = sortState.dir === 'desc' ? -1 : 1;
      if (field === 'date'){
        return (a.date - b.date) * dir;
      }
      const valA = String(a[field] ?? '').toLowerCase();
      const valB = String(b[field] ?? '').toLowerCase();
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }

  function renderTable(){
    if (!tableBody) return;
    const filtered = applyFilters();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageItems = filtered.slice(startIdx, endIdx);

    tableBody.innerHTML = pageItems.map((row) => `
      <tr>
        <td>${row.name}</td>
        <td>${row.username}</td>
        <td>${row.school}</td>
        <td>${row.program}</td>
        <td>${fmtDate(row.date)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="text-body-secondary small">No reports in this timeframe.</td></tr>';

    if (entryInfo){
      entryInfo.textContent = total ? `Showing ${startIdx + 1} to ${endIdx} of ${total} entries` : 'Showing 0 to 0 of 0 entries';
    }

    renderPager(totalPages);
  }

  function renderPager(totalPages){
    if (!pager) return;
    const buttons = [];
    const pageNumbers = [];
    buttons.push(`<button class="btn btn-outline-secondary btn-sm" type="button" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`);

    if (totalPages <= 5){
      for (let i = 1; i <= totalPages; i++){
        pageNumbers.push(i);
      }
    }else{
      pageNumbers.push(1, 2, 3, 4, totalPages);
    }

    pageNumbers.forEach((num, idx) => {
      if (totalPages > 5 && idx === 4){
        buttons.push('<span class="text-body-secondary">…</span>');
      }
      const active = num === currentPage ? 'btn-cpnw-primary' : 'btn-outline-secondary';
      buttons.push(`<button class="btn btn-sm ${active}" type="button" data-page="${num}">${num}</button>`);
    });

    buttons.push(`<button class="btn btn-outline-secondary btn-sm" type="button" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`);
    pager.innerHTML = buttons.join('');
  }

  function populateFilters(){
    if (reportSchool){
      const schools = [...new Set(rows.map(r => r.school))].sort();
      reportSchool.innerHTML = ['<option value="">All schools</option>', ...schools.map(s => `<option value="${s}">${s}</option>`)].join('');
    }
    if (reportProgram){
      const programs = [...new Set(rows.map(r => r.program))].sort();
      reportProgram.innerHTML = ['<option value="">All programs</option>', ...programs.map(p => `<option value="${p}">${p}</option>`)].join('');
    }
  }

  function exportCsv(){
    const filtered = applyFilters();
    const headers = ['Name', 'Username', 'School', 'Program', 'Date ran'];
    const lines = [headers.join(',')];

    filtered.forEach((row) => {
      const values = [
        row.name,
        row.username,
        row.school,
        row.program,
        fmtDate(row.date)
      ].map(value => `"${String(value).replace(/"/g, '""')}"`);
      lines.push(values.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const range = dateRangeFromFilters();
    const filename = range.start && range.end
      ? `cpnw-watch-report-${range.start.toISOString().slice(0,10)}-${range.end.toISOString().slice(0,10)}.csv`
      : 'cpnw-watch-report.csv';
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  pager?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    const val = btn.dataset.page;
    const totalPages = Math.max(1, Math.ceil(applyFilters().length / pageSize));
    if (val === 'prev'){
      currentPage = Math.max(1, currentPage - 1);
    }else if (val === 'next'){
      currentPage = Math.min(totalPages, currentPage + 1);
    }else{
      currentPage = Number(val) || 1;
    }
    renderTable();
  });

  pageSizeSelect?.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value || 10);
    currentPage = 1;
    renderTable();
  });

  reportApply?.addEventListener('click', () => {
    currentPage = 1;
    renderTable();
  });

  reportReset?.addEventListener('click', () => {
    if (reportSearch) reportSearch.value = '';
    if (reportSchool) reportSchool.value = '';
    if (reportProgram) reportProgram.value = '';
    if (rangeMonth) rangeMonth.checked = true;
    if (rangeCustom) rangeCustom.checked = false;
    if (reportStart) reportStart.value = '';
    if (reportEnd) reportEnd.value = '';
    setDefaultMonth();
    applyRangeMode();
    currentPage = 1;
    renderTable();
  });

  reportExport?.addEventListener('click', exportCsv);

  [reportSearch, reportSchool, reportProgram].forEach(el => {
    if (!el) return;
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      currentPage = 1;
      renderTable();
    });
  });

  [rangeMonth, rangeCustom].forEach(el => {
    el?.addEventListener('change', () => {
      applyRangeMode();
      currentPage = 1;
      renderTable();
    });
  });

  [reportMonth, reportStart, reportEnd].forEach(el => {
    el?.addEventListener('change', () => {
      currentPage = 1;
      renderTable();
    });
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
      currentPage = 1;
      renderTable();
    });
  });

  rows = buildRows();
  setDefaultMonth();
  applyRangeMode();
  populateFilters();
  renderTable();
})();
