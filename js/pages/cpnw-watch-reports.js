(function(){
  const tableBody = document.getElementById('watchTableBody');
  const entryInfo = document.getElementById('watchEntryInfo');
  const pager = document.getElementById('watchPager');

  const modalEl = document.getElementById('watchModal');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
  const modalLabel = document.getElementById('watchModalLabel');
  const modalSub = document.getElementById('watchModalSub');
  const modalProgram = document.getElementById('watchModalProgram');
  const modalDob = document.getElementById('watchModalDob');
  const modalReqName = document.getElementById('watchModalReqName');
  const modalStatus = document.getElementById('watchModalStatus');
  const sortButtons = document.querySelectorAll('.sort');
  const uploadInput = document.getElementById('watchReqUpload');
  const uploadedWrap = document.getElementById('watchUploadedWrap');
  const uploadedList = document.getElementById('watchUploadedList');

  const watchApprove = document.getElementById('watchApprove');
  const watchConditional = document.getElementById('watchConditional');
  const watchReject = document.getElementById('watchReject');
  const decisionReasonWrap = document.getElementById('watchDecisionReasonWrap');
  const decisionReason = document.getElementById('watchDecisionReason');
  const decisionSave = document.getElementById('watchDecisionSave');
  const decisionSaved = document.getElementById('watchDecisionSaved');
  const decisionError = document.getElementById('watchDecisionError');

  const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];

  const WATCH_PROGRAMS = [
    { school: 'CPNW University', program: 'ADN', watchRequirement: 'CPNW: CPNW WATCH', reviewerService: true },
    { school: 'CPNW Education', program: 'BSN', watchRequirement: 'CPNW: Independent WATCH', reviewerService: true },
    { school: 'CPNW University', program: 'BSN', watchRequirement: 'CPNW: Independent WATCH', reviewerService: false },
    { school: 'CPNW Education', program: 'RadTech', watchRequirement: 'CPNW: CPNW WATCH', reviewerService: false }
  ];

  const WATCH_PROGRAM_KEYS = new Map(WATCH_PROGRAMS.map(p => [`${p.school}::${p.program}`, p]));

  const PAGE_SIZE = 10;
  let currentPage = 1;
  let currentContext = { email: '', reqName: '' };
  let sortState = { field: 'name', dir: 'asc' };

  function loadJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) ?? fallback;
    }catch{
      return fallback;
    }
  }

  function getDecisionStore(){
    return loadJSON('cpnw-reviewer-decisions-v1', {});
  }

  function saveDecision(email, reqName, record){
    const store = getDecisionStore();
    store[`${email}|${reqName}`.toLowerCase()] = record;
    try{
      localStorage.setItem('cpnw-reviewer-decisions-v1', JSON.stringify(store));
    }catch{}
  }

  function getDecision(email, reqName){
    const store = getDecisionStore();
    return store[`${email}|${reqName}`.toLowerCase()] || null;
  }

  function getStudentData(email){
    const key = `cpnw-student-data-${String(email || '').toLowerCase()}`;
    return loadJSON(key, { submissions: {} });
  }

  function saveStudentData(email, data){
    const key = `cpnw-student-data-${String(email || '').toLowerCase()}`;
    try{
      localStorage.setItem(key, JSON.stringify(data));
    }catch{}
  }

  function seededStatus(email, reqLabel){
    const seed = Array.from(String(email)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    if (/watch/i.test(reqLabel)){
      return seed % 5 === 0 ? 'Submitted' : 'Not Submitted';
    }
    return seed % 3 === 0 ? 'Submitted' : 'Not Submitted';
  }

  function requirementStatus(email, reqName, submissionKey){
    const decision = getDecision(email, reqName);
    if (decision?.status) return decision.status;
    const submissions = getStudentData(email)?.submissions || {};
    if (submissions && submissions[submissionKey]) return 'Submitted';
    return seededStatus(email, reqName);
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
    return { first: parts[0], middle: parts[1].charAt(0), last: parts.slice(2).join(' ') };
  }

  function seedDob(value){
    const seed = Array.from(String(value)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const year = 1985 + (seed % 15);
    const month = seed % 12;
    const day = (seed % 27) + 1;
    return new Date(year, month, day);
  }

  function fmtDate(d){
    if (!(d instanceof Date)) return '—';
    return d.toLocaleDateString();
  }

  function buildRows(){
    return roster.map((person) => {
      const { program, school } = resolveProgram(person);
      const key = `${school}::${program}`;
      const watchProgram = WATCH_PROGRAM_KEYS.get(key);
      if (!watchProgram) return null;
      const nameParts = parseName(person.name);
      const dob = person.profile?.dob ? new Date(person.profile.dob) : seedDob(person.email || person.name);
      return {
        id: `${person.email}|${watchProgram.watchRequirement}`,
        email: person.email,
        first: `${nameParts.first}, ${nameParts.last}`.trim().replace(/,$/, ''),
        middle: nameParts.middle || String.fromCharCode(65 + (person.email?.length || 1) % 26),
        dob,
        program: watchProgram.program,
        school: watchProgram.school,
        watchRequirement: watchProgram.watchRequirement,
        reviewerService: watchProgram.reviewerService
      };
    }).filter(Boolean);
  }

  const rows = buildRows();

  function renderTable(){
    if (!tableBody) return;
    const sorted = rows.slice().sort((a, b) => {
      const field = sortState.field;
      const dir = sortState.dir === 'desc' ? -1 : 1;
      if (field === 'dob') return (a.dob - b.dob) * dir;
      if (field === 'name'){
        const nameCmp = a.first.localeCompare(b.first, undefined, { sensitivity: 'base' });
        return nameCmp * dir;
      }
      if (field === 'middle'){
        const midCmp = String(a.middle || '').localeCompare(String(b.middle || ''), undefined, { sensitivity: 'base' });
        return midCmp * dir;
      }
      if (field === 'program'){
        const keyA = `${a.program} ${a.school}`.toLowerCase();
        const keyB = `${b.program} ${b.school}`.toLowerCase();
        if (keyA < keyB) return -1 * dir;
        if (keyA > keyB) return 1 * dir;
        return 0;
      }
      return 0;
    });
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const pageRows = sorted.slice(start, end);

    tableBody.innerHTML = pageRows.map((row) => `
      <tr>
        <td>
          <button type="button" class="btn btn-link p-0 text-start" data-watch-open="${row.id}">${row.first}</button>
        </td>
        <td>${row.middle}</td>
        <td>${fmtDate(row.dob)}</td>
        <td class="text-uppercase">${row.program} &nbsp;•&nbsp; ${row.school}</td>
        <td>
          <button class="btn btn-cpnw btn-cpnw-primary btn-sm" type="button" data-watch-open="${row.id}">Submit</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="text-body-secondary small">No WATCH reports available.</td></tr>';

    if (entryInfo){
      entryInfo.textContent = total ? `Showing ${start + 1} to ${end} of ${total} entries` : 'Showing 0 to 0 of 0 entries';
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

  function setAlert(message){
    if (!decisionError) return;
    if (!message){
      decisionError.classList.add('d-none');
      decisionError.textContent = '';
      return;
    }
    decisionError.classList.remove('d-none');
    decisionError.textContent = message;
  }

  function openWatchModal(row){
    if (!modal) return;
    currentContext = { email: row.email, reqName: row.watchRequirement };
    if (modalLabel) modalLabel.textContent = row.first;
    if (modalSub) modalSub.textContent = row.email;
    if (modalProgram) modalProgram.textContent = `${row.program} • ${row.school}`;
    if (modalDob) modalDob.textContent = fmtDate(row.dob);
    if (modalReqName) modalReqName.textContent = row.watchRequirement;

    const status = requirementStatus(row.email, row.watchRequirement, 'cpnw_watch');
    if (modalStatus) modalStatus.textContent = `Status: ${status}`;
    if (uploadInput) uploadInput.value = '';
    renderUploads(row.email);

    [watchApprove, watchConditional, watchReject].forEach(el => { if (el) el.checked = false; });
    if (decisionReason) decisionReason.value = '';
    decisionReasonWrap?.classList.add('d-none');
    decisionSaved?.classList.add('d-none');
    setAlert('');

    const saved = getDecision(row.email, row.watchRequirement);
    if (saved?.status){
      const s = String(saved.status).toLowerCase();
      if (watchApprove) watchApprove.checked = s === 'approved';
      if (watchConditional) watchConditional.checked = s === 'conditionally approved';
      if (watchReject) watchReject.checked = s === 'rejected';
      if (decisionReason) decisionReason.value = saved.reason || '';
      decisionReasonWrap?.classList.toggle('d-none', !(watchConditional?.checked || watchReject?.checked));
      if (modalStatus) modalStatus.textContent = `Status: ${saved.status}`;
    }

    modal.show();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-watch-open]');
    if (!btn) return;
    const id = btn.dataset.watchOpen;
    const row = rows.find(r => r.id === id);
    if (row){
      openWatchModal(row);
    }
  });

  pager?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    const val = btn.dataset.page;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (val === 'prev'){
      currentPage = Math.max(1, currentPage - 1);
    }else if (val === 'next'){
      currentPage = Math.min(totalPages, currentPage + 1);
    }else{
      currentPage = Number(val) || 1;
    }
    renderTable();
  });

  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('decision-radio')) return;
    const requires = e.target.hasAttribute('data-requires-reason');
    decisionReasonWrap?.classList.toggle('d-none', !requires);
  });

  decisionSave?.addEventListener('click', () => {
    if (!currentContext.email || !currentContext.reqName){
      setAlert('Missing requirement context.');
      return;
    }
    const status =
      watchApprove?.checked ? 'Approved' :
      watchConditional?.checked ? 'Conditionally Approved' :
      watchReject?.checked ? 'Rejected' :
      '';
    const reason = (decisionReason?.value || '').trim();
    if (!status){
      setAlert('Select a decision before saving.');
      return;
    }
    if ((status === 'Conditionally Approved' || status === 'Rejected') && !reason){
      setAlert('Please enter a reason for conditional approval or rejection.');
      return;
    }

    saveDecision(currentContext.email, currentContext.reqName, {
      status,
      reason,
      at: new Date().toISOString()
    });

    if (uploadInput && uploadInput.files && uploadInput.files.length){
      const data = getStudentData(currentContext.email);
      data.submissions = data.submissions && typeof data.submissions === 'object' ? data.submissions : {};
      const files = Array.from(uploadInput.files).map(f => f.name);
      data.submissions.cpnw_watch = data.submissions.cpnw_watch || {};
      data.submissions.cpnw_watch.files = (data.submissions.cpnw_watch.files || []).concat(files);
      data.submissions.cpnw_watch.submittedAt = new Date().toISOString();
      saveStudentData(currentContext.email, data);
      renderUploads(currentContext.email);
      uploadInput.value = '';
    }

    setAlert('');
    decisionSaved?.classList.remove('d-none');
    if (modalStatus) modalStatus.textContent = `Status: ${status}`;
  });

  function renderUploads(email){
    if (!uploadedWrap || !uploadedList) return;
    const data = getStudentData(email);
    const files = Array.isArray(data.submissions?.cpnw_watch?.files) ? data.submissions.cpnw_watch.files : [];
    if (!files.length){
      uploadedWrap.classList.add('d-none');
      uploadedList.innerHTML = '';
      return;
    }
    uploadedWrap.classList.remove('d-none');
    uploadedList.innerHTML = files.map(name => `
      <li class="d-flex justify-content-between align-items-center gap-2">
        <span>${name}</span>
        <button class="btn btn-outline-secondary btn-sm" type="button" data-download-file="${encodeURIComponent(name)}">Download</button>
      </li>
    `).join('');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-download-file]');
    if (!btn) return;
    alert('This is a demo. Uploaded documents would download in a real scenario.');
  });

  renderTable();

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
})();
