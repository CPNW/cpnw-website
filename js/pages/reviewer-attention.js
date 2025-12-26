(function(){
  const reviewTableBody = document.getElementById('reviewTableBody');
  const reviewSearch = document.getElementById('reviewSearch');
  const schoolFilter = document.getElementById('schoolFilter');
  const programFilter = document.getElementById('programFilter');
  const reviewPageSizeSelect = document.getElementById('reviewPageSize');
  const reviewPrevPage = document.getElementById('reviewPrevPage');
  const reviewNextPage = document.getElementById('reviewNextPage');
  const reviewPageInfo = document.getElementById('reviewPageInfo');
  const statusChipButtons = document.querySelectorAll('[data-status-chip]');
  const sortButtons = document.querySelectorAll('.sort');
  const detailModalEl = document.getElementById('studentReqDetailModal');
  const detailModal = detailModalEl ? new bootstrap.Modal(detailModalEl) : null;

  const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];

  const DVS_PACKAGES = new Set(['sp-13', 'sp-14', 'my-17', 'my-18']);
  const PROGRAM_PACKAGES = [
    { school: 'CPNW University', program: 'ADN', packageId: 'sp-13' },
    { school: 'CPNW University', program: 'BSN', packageId: 'sp-11' },
    { school: 'CPNW University', program: 'SurgTech', packageId: 'sp-12' },
    { school: 'CPNW Education', program: 'ADN', packageId: 'sp-12' },
    { school: 'CPNW Education', program: 'BSN', packageId: 'my-17' },
    { school: 'CPNW Education', program: 'RadTech', packageId: 'sp-11' }
  ];
  const dvsPrograms = PROGRAM_PACKAGES.filter(p => DVS_PACKAGES.has(p.packageId));
  const dvsProgramKeys = new Set(dvsPrograms.map(p => `${p.school}::${p.program}`));

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

  const REQUIREMENT_META = {
    'CPNW: Varicella': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: Influenza': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: Tetanus, Diphtheria, & Pertussis': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: Criminal History Disclosure': { type: 'Forms', frequency: 'Annual' },
    'CPNW: BLS Provider Course': { type: 'Certs', frequency: 'Annual' },
    'CPNW: Tuberculin': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: Hepatitis B': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: Measles, Mumps, and Rubella': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: COVID-19': { type: 'Immunization', frequency: 'Annual' },
    'CPNW: Independent Background Check': { type: 'Forms', frequency: 'Annual' },
    'CPNW: Independent WATCH': { type: 'Forms', frequency: 'Annual' }
  };

  const TODAY = new Date();
  const DAYS = 86400000;

  const detailLabel = document.getElementById('studentReqDetailModalLabel');
  const detailMeta = document.getElementById('studentReqDetailMeta');
  const detailTypeLabel = document.getElementById('studentReqDetailTypeLabel');
  const detailInstructions = document.getElementById('studentReqDetailInstructions');
  const detailSaved = document.getElementById('studentReqDetailSaved');
  const detailError = document.getElementById('studentReqDetailError');
  const submissionWrap = document.getElementById('studentReqSubmissionWrap');
  const uploadWrap = document.getElementById('studentReqUploadWrap');
  const elearningLaunchWrap = document.getElementById('elearningLaunchWrap');
  const elearningLaunchBtn = document.getElementById('elearningLaunchBtn');
  const elearningStatusWrap = document.getElementById('elearningStatusWrap');
  const submissionOptionsWrap = document.getElementById('studentSubmissionOptions');
  const subCompletedFields = document.getElementById('studentSubCompletedFields');
  const subSeriesFields = document.getElementById('studentSubSeriesFields');
  const subOtherFields = document.getElementById('studentSubOtherFields');
  const subCompletedLabel = document.querySelector('label[for="studentSubCompleted"]');
  const subSeriesLabel = document.querySelector('label[for="studentSubSeries"]');
  const subOtherLabel = document.querySelector('label[for="studentSubOther"]');
  const subCompletedDateLabel = document.querySelector('label[for="studentCompletedDate"]');
  const subSeriesStartLabel = document.querySelector('label[for="studentSeriesStart"]');
  const subSeriesDueLabel = document.querySelector('label[for="studentSeriesDue"]');
  const subOtherRadio = document.getElementById('studentSubOther');
  const subOtherWrap = subOtherRadio?.closest('.form-check');
  const subSeriesDueWrap = document.getElementById('studentSeriesDue')?.closest('.col-12');
  const defaultSubCompletedLabel = subCompletedLabel?.textContent || 'Vaccinated / Completed';
  const defaultSubSeriesLabel = subSeriesLabel?.textContent || 'Series in progress';
  const defaultSubOtherLabel = subOtherLabel?.textContent || 'Other';
  const defaultSubCompletedDateLabel = subCompletedDateLabel?.textContent || 'Vaccination / completion date';
  const defaultSubSeriesStartLabel = subSeriesStartLabel?.textContent || 'Series start';
  const defaultSubSeriesDueLabel = subSeriesDueLabel?.textContent || 'Next dose due';
  const subCompletedDate = document.getElementById('studentCompletedDate');
  const subSeriesStart = document.getElementById('studentSeriesStart');
  const subSeriesDue = document.getElementById('studentSeriesDue');
  const subOtherNotes = document.getElementById('studentOtherNotes');
  const criminalDisclosureWrap = document.getElementById('criminalDisclosureWrap');
  const criminalDisclosureDates = document.getElementById('criminalDisclosureDates');
  const criminalDisclosureAdd = document.getElementById('criminalDisclosureAdd');
  const criminalDisclosureDate0 = document.getElementById('criminalDisclosureDate0');
  const criminalDisclosureDownload = document.getElementById('criminalDisclosureDownload');
  const criminalDisclosureDownloadWrap = document.getElementById('criminalDisclosureDownloadWrap');
  const hepBSubmissionWrap = document.getElementById('hepBSubmissionWrap');
  const hepBOptionTiter = document.getElementById('hepBOptionTiter');
  const hepBOptionNoTiter = document.getElementById('hepBOptionNoTiter');
  const hepBTiterFields = document.getElementById('hepBTiterFields');
  const hepBTiterDate = document.getElementById('hepBTiterDate');
  const hepBTiterPositive = document.getElementById('hepBTiterPositive');
  const hepBNoTiterFields = document.getElementById('hepBNoTiterFields');
  const hepBReasonNonConverter = document.getElementById('hepBReasonNonConverter');
  const hepBReasonSeriesInProcess = document.getElementById('hepBReasonSeriesInProcess');
  const hepBReasonHistory = document.getElementById('hepBReasonHistory');
  const hepBReasonHealth = document.getElementById('hepBReasonHealth');
  const hepBNonConverterWrap = document.getElementById('hepBNonConverterWrap');
  const hepBSeriesInProcessWrap = document.getElementById('hepBSeriesInProcessWrap');
  const hepBSeriesInProcessDownload = document.getElementById('hepBSeriesInProcessDownload');
  const hepBHealthReasonWrap = document.getElementById('hepBHealthReasonWrap');
  const hepBHealthReasonInput = document.getElementById('hepBHealthReasonInput');
  const hepBHealthReasonCount = document.getElementById('hepBHealthReasonCount');
  const hepBNcSeries1Two = document.getElementById('hepBNcSeries1Two');
  const hepBNcSeries1Three = document.getElementById('hepBNcSeries1Three');
  const hepBNcSeries1TwoFields = document.getElementById('hepBNcSeries1TwoFields');
  const hepBNcSeries1ThreeFields = document.getElementById('hepBNcSeries1ThreeFields');
  const hepBNcSeries2Two = document.getElementById('hepBNcSeries2Two');
  const hepBNcSeries2Three = document.getElementById('hepBNcSeries2Three');
  const hepBNcSeries2TwoFields = document.getElementById('hepBNcSeries2TwoFields');
  const hepBNcSeries2ThreeFields = document.getElementById('hepBNcSeries2ThreeFields');
  const hepBIpSeries1Two = document.getElementById('hepBIpSeries1Two');
  const hepBIpSeries1Three = document.getElementById('hepBIpSeries1Three');
  const hepBIpSeries1TwoFields = document.getElementById('hepBIpSeries1TwoFields');
  const hepBIpSeries1ThreeFields = document.getElementById('hepBIpSeries1ThreeFields');
  const msgList = document.getElementById('studentReqMessages');
  const msgInput = document.getElementById('studentReqMessageInput');
  const msgSend = document.getElementById('studentReqMessageSend');
  const msgToEducation = document.getElementById('msgToEducation');
  const msgToCpnw = document.getElementById('msgToCpnw');
  const msgToHealthcare = document.getElementById('msgToHealthcare');
  const filesEl = document.getElementById('studentReqFiles');
  const fileListEl = document.getElementById('studentReqFileList');
  const uploadedWrap = document.getElementById('studentReqUploadedWrap');
  const uploadedList = document.getElementById('studentReqUploadedList');
  const submitBtn = document.getElementById('studentReqSubmitBtn');
  const decApprove = document.getElementById('decApprove');
  const decConditional = document.getElementById('decConditional');
  const decReject = document.getElementById('decReject');
  const decisionReasonWrap = document.getElementById('decisionReasonWrap');
  const decisionReason = document.getElementById('decisionReason');
  const decisionSave = document.getElementById('reqDecisionSave');
  const decisionSaved = document.getElementById('reqDecisionSaved');
  let currentReqId = '';
  let currentReqName = '';
  let currentStudentEmail = '';
  let currentMessages = [];
  let disclosureExtraCount = 0;

  function loadJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) ?? fallback;
    }catch{
      return fallback;
    }
  }

  function getStudentData(email){
    const key = `cpnw-student-data-${String(email || '').toLowerCase()}`;
    return loadJSON(key, { submissions: {}, elearning: {}, messages: {} });
  }

  function seedElearningIfMissing(email){
    const key = `cpnw-student-data-${String(email || '').toLowerCase()}`;
    const data = getStudentData(email);
    if (data.elearning && Object.keys(data.elearning).length){
      return data;
    }
    const now = new Date();
    const daysAgo = (d) => {
      const x = new Date(now);
      x.setDate(x.getDate() - d);
      return x.toISOString();
    };
    const expiresInDays = (d) => {
      const x = new Date(now);
      x.setDate(x.getDate() + d);
      return x.toISOString();
    };
    data.elearning = {
      elearn_1: { attempts:[{ at: daysAgo(80), score: 91 }], passedAt: daysAgo(80), expiresAt: expiresInDays(285) },
      elearn_2: { attempts:[{ at: daysAgo(72), score: 88 }], passedAt: daysAgo(72), expiresAt: expiresInDays(293) },
      elearn_3: { attempts:[{ at: daysAgo(60), score: 84 }], passedAt: daysAgo(60), expiresAt: expiresInDays(305) }
    };
    try{
      localStorage.setItem(key, JSON.stringify(data));
    }catch{}
    return data;
  }

  function getDecisionStore(){
    return loadJSON('cpnw-reviewer-decisions-v1', {});
  }

  function getDecision(email, reqName){
    const store = getDecisionStore();
    return store[`${email}|${reqName}`.toLowerCase()] || null;
  }

  function saveDecision(email, reqName, record){
    const store = getDecisionStore();
    store[`${email}|${reqName}`.toLowerCase()] = record;
    try{
      localStorage.setItem('cpnw-reviewer-decisions-v1', JSON.stringify(store));
    }catch{}
  }

  function seededStatus(email, reqLabel){
    const seed = Array.from(String(email)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    if (/watch/i.test(reqLabel)){
      return seed % 11 === 0 ? 'Not Submitted' : 'Submitted';
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

  function statusBadge(status){
    const s = String(status || '').toLowerCase();
    if (s === 'needs-review') return '<span class="badge text-bg-warning text-dark">Needs review</span>';
    if (s === 'submitted') return '<span class="badge text-bg-info text-dark">Submitted</span>';
    if (s === 'in review') return '<span class="badge text-bg-warning text-dark">In Review</span>';
    if (s === 'approved') return '<span class="badge text-bg-success">Approved</span>';
    if (s === 'conditionally approved') return '<span class="badge text-bg-primary">Conditionally Approved</span>';
    if (s === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
    return '<span class="badge text-bg-secondary">Not Submitted</span>';
  }

  function setAlert(el, message){
    if (!el) return;
    if (!message){
      el.classList.add('d-none');
      el.textContent = '';
      return;
    }
    el.classList.remove('d-none');
    el.textContent = message;
  }

  function resetDetailAlerts(){
    setAlert(detailSaved, '');
    setAlert(detailError, '');
  }

  function renderMessages(){
    if (!msgList) return;
    if (!currentMessages.length){
      msgList.innerHTML = '<div class="text-body-secondary small">No messages yet.</div>';
      return;
    }
    msgList.innerHTML = currentMessages.map(m => `
      <div class="mb-2">
        <div class="fw-semibold">${m.from || 'Message'}</div>
        <div class="small text-body-secondary">${m.at || ''}${m.to ? ` • To: ${m.to.join(', ')}` : ''}</div>
        <div>${m.body || ''}</div>
      </div>
    `).join('');
  }

  function renderUploadedFiles(reqId){
    if (!uploadedWrap || !uploadedList) return;
    const submissions = getStudentData(currentStudentEmail)?.submissions || {};
    const files = Array.isArray(submissions[reqId]?.files) ? submissions[reqId].files : [];
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

  function isTdapRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('tetanus') && label.includes('pertussis');
  }

  function isHepBRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('hepatitis b');
  }

  function isCriminalDisclosureRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('criminal history disclosure');
  }

  function buildRequirementInstructions(name){
    if (isTdapRequirement(name)){
      return [
        '<p class="fw-semibold mb-1">Instructions</p>',
        '<p class="mb-2">CPNW Tetanus, Diphtheria, Pertussis (Tdap)</p>',
        '<p>You must provide proof of receiving the Tdap vaccine (Tetanus, Diphtheria, Pertussis). After your initial Tdap dose, a Td or Tdap booster is required every 10 years to remain compliant.</p>',
        '<p class="mb-2">Vaccination Documentation:</p>',
        '<ul class="mb-0">',
        '<li>At least one documented dose of Tdap</li>',
        '<li>And, if applicable, a Td or Tdap booster if more than 10 years have passed since the initial Tdap dose</li>',
        '</ul>'
      ].join('');
    }
    if (isCriminalDisclosureRequirement(name)){
      return [
        '<p class="fw-semibold mb-1">Instructions</p>',
        '<p class="mb-2">CPNW: Criminal History Disclosure Form</p>',
        '<p>A newly completed Criminal History Disclosure form is required each year a student is in program.</p>',
        '<p>Utilize the provided document link, complete the form, and upload document to meet this requirement.</p>'
      ].join('');
    }
    return `<p>Upload the required documentation for ${name}.</p>`;
  }

  function applySubmissionTemplate(reqName){
    const isTdap = isTdapRequirement(reqName);
    const isHepB = isHepBRequirement(reqName);
    const isCriminal = isCriminalDisclosureRequirement(reqName);
    if (subCompletedLabel) subCompletedLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedLabel;
    if (subSeriesLabel) subSeriesLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesLabel;
    if (subOtherLabel) subOtherLabel.textContent = defaultSubOtherLabel;
    if (subCompletedDateLabel) subCompletedDateLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedDateLabel;
    if (subSeriesStartLabel) subSeriesStartLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesStartLabel;
    if (subSeriesDueLabel) subSeriesDueLabel.textContent = defaultSubSeriesDueLabel;
    subOtherWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB);
    subSeriesDueWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB);
    submissionOptionsWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB);
    criminalDisclosureWrap?.classList.toggle('d-none', !isCriminal);
    criminalDisclosureDownloadWrap?.classList.toggle('d-none', !isCriminal);
    hepBSubmissionWrap?.classList.toggle('d-none', !isHepB);
    if (isTdap){
      subCompletedFields?.classList.remove('d-none');
      subSeriesFields?.classList.remove('d-none');
      subOtherFields?.classList.add('d-none');
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
    }else if (isCriminal){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      resetDisclosureFields();
      hepBSubmissionWrap?.classList.add('d-none');
    }else if (isHepB){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      resetHepBFields();
    }else{
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
    }
  }

  function resetHepBFields(){
    if (hepBSubmissionWrap){
      const inputs = hepBSubmissionWrap.querySelectorAll('input, textarea');
      inputs.forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox'){
          el.checked = false;
        }else{
          el.value = '';
        }
      });
    }
    if (hepBHealthReasonCount) hepBHealthReasonCount.textContent = '0/200';
    hepBTiterFields?.classList.add('d-none');
    hepBNoTiterFields?.classList.add('d-none');
    hepBNonConverterWrap?.classList.add('d-none');
    hepBSeriesInProcessWrap?.classList.add('d-none');
    hepBHealthReasonWrap?.classList.add('d-none');
    [hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields].forEach(el => el?.classList.add('d-none'));
  }

  function setSeriesFields(twoFields, threeFields, isThree){
    if (!twoFields || !threeFields) return;
    twoFields.classList.toggle('d-none', !!isThree);
    threeFields.classList.toggle('d-none', !isThree);
  }

  function updateHepBMainOption(){
    const showTiter = !!hepBOptionTiter?.checked;
    const showNoTiter = !!hepBOptionNoTiter?.checked;
    hepBTiterFields?.classList.toggle('d-none', !showTiter);
    hepBNoTiterFields?.classList.toggle('d-none', !showNoTiter);
    if (!showNoTiter){
      [hepBReasonNonConverter, hepBReasonSeriesInProcess, hepBReasonHistory, hepBReasonHealth].forEach(el => {
        if (el) el.checked = false;
      });
      hepBNonConverterWrap?.classList.add('d-none');
      hepBSeriesInProcessWrap?.classList.add('d-none');
      hepBHealthReasonWrap?.classList.add('d-none');
    }
  }

  function updateHepBReason(){
    const showNonConverter = !!hepBReasonNonConverter?.checked;
    const showSeriesInProcess = !!hepBReasonSeriesInProcess?.checked;
    const showHealthReason = !!hepBReasonHealth?.checked;
    hepBNonConverterWrap?.classList.toggle('d-none', !showNonConverter);
    hepBSeriesInProcessWrap?.classList.toggle('d-none', !showSeriesInProcess);
    hepBHealthReasonWrap?.classList.toggle('d-none', !showHealthReason);
  }

  function updateHepBHealthReasonCount(){
    if (!hepBHealthReasonInput || !hepBHealthReasonCount) return;
    const len = hepBHealthReasonInput.value.length;
    hepBHealthReasonCount.textContent = `${len}/200`;
  }

  function resetDisclosureFields(){
    if (criminalDisclosureDate0) criminalDisclosureDate0.value = '';
    if (criminalDisclosureDates){
      const extras = criminalDisclosureDates.querySelectorAll('[data-disclosure-extra]');
      extras.forEach(el => el.remove());
    }
    disclosureExtraCount = 0;
    criminalDisclosureAdd?.classList.add('d-none');
  }

  function updateDisclosureAddVisibility(){
    if (!criminalDisclosureAdd || !criminalDisclosureDates) return;
    const inputs = Array.from(criminalDisclosureDates.querySelectorAll('input[type="date"]'));
    const lastInput = inputs[inputs.length - 1];
    if (lastInput && lastInput.value){
      criminalDisclosureAdd.classList.remove('d-none');
    }else{
      criminalDisclosureAdd.classList.add('d-none');
    }
  }

  function addDisclosureDateField(){
    if (!criminalDisclosureDates) return;
    disclosureExtraCount += 1;
    const fieldId = `criminalDisclosureExtra${disclosureExtraCount}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'col-12 col-md-6';
    wrapper.setAttribute('data-disclosure-extra', 'true');
    wrapper.innerHTML = `
      <label class="form-label small mb-1" for="${fieldId}">Disclosure Signature Date</label>
      <input type="date" class="form-control" id="${fieldId}">
    `;
    criminalDisclosureDates.appendChild(wrapper);
    const input = wrapper.querySelector('input[type="date"]');
    input?.addEventListener('input', updateDisclosureAddVisibility);
    updateDisclosureAddVisibility();
  }

  function showSelectedFiles(){
    if (!filesEl || !fileListEl) return;
    const files = Array.from(filesEl.files || []);
    fileListEl.innerHTML = files.map(f => `<li>${f.name}</li>`).join('') || '<li class="text-body-secondary">No files selected.</li>';
  }

  function renderDetailMeta(reqInfo){
    if (!detailMeta) return;
    const exp = reqInfo.expiration ? formatDate(reqInfo.expiration) : '—';
    const freqLabel = reqInfo.frequency || '—';
    detailMeta.innerHTML = `CPNW requirements • <span class="badge text-bg-secondary">${freqLabel}</span> • ${statusBadge(reqInfo.status)} • Exp: ${exp} • Due: —`;
  }

  function openRequirementDetail(reqInfo){
    if (!detailModal) return;
    resetDetailAlerts();
    currentReqId = reqInfo.id;
    currentReqName = reqInfo.name || '';
    const data = getStudentData(currentStudentEmail);
    const stored = data?.messages && typeof data.messages === 'object' ? data.messages[currentReqId] : [];
    if (Array.isArray(stored) && stored.length && Array.isArray(stored[0])){
      currentMessages = stored.flat();
    }else if (Array.isArray(stored)){
      currentMessages = stored;
    }else{
      currentMessages = [];
    }
    if (detailTypeLabel) detailTypeLabel.textContent = `${reqInfo.type || 'Requirement'} Requirement`;
    if (detailLabel) detailLabel.textContent = reqInfo.name || '';
    if (detailInstructions) detailInstructions.innerHTML = reqInfo.instructionsHTML || '<p class="text-body-secondary">No instructions provided.</p>';

    renderDetailMeta(reqInfo);

    elearningLaunchWrap?.classList.add('d-none');
    elearningStatusWrap?.classList.add('d-none');
    submissionWrap?.classList.remove('d-none');
    uploadWrap?.classList.remove('d-none');
    applySubmissionTemplate(reqInfo.name);

    [subCompletedDate, subSeriesStart, subSeriesDue, subOtherNotes].forEach(el => {
      if (el) el.value = '';
    });

    renderUploadedFiles(reqInfo.id);
    if (filesEl) filesEl.value = '';
    showSelectedFiles();
    renderMessages();
    if (msgInput) msgInput.value = '';
    [msgToEducation, msgToHealthcare, msgToCpnw].forEach(el => { if (el) el.checked = false; });
    if (decApprove) decApprove.checked = false;
    if (decConditional) decConditional.checked = false;
    if (decReject) decReject.checked = false;
    if (decisionReason) decisionReason.value = '';
    decisionReasonWrap?.classList.add('d-none');
    if (decisionSaved) decisionSaved.classList.add('d-none');

    const savedDecision = currentReqName ? getDecision(currentStudentEmail, currentReqName) : null;
    if (savedDecision?.status){
      const status = String(savedDecision.status || '').toLowerCase();
      if (decApprove) decApprove.checked = status === 'approved';
      if (decConditional) decConditional.checked = status === 'conditionally approved';
      if (decReject) decReject.checked = status === 'rejected';
      if (decisionReason) decisionReason.value = savedDecision.reason || '';
      decisionReasonWrap?.classList.toggle('d-none', !(decConditional?.checked || decReject?.checked));
    }
    detailModal.show();
  }

  function resolveProgram(person){
    const program = person.programs?.[0] || person.profile?.program || '';
    const school = person.schools?.[0] || person.profile?.school || '';
    return { program, school };
  }

  function isDvsProgram(program, school){
    return dvsProgramKeys.has(`${school}::${program}`);
  }

  function stringSeed(value){
    return Array.from(String(value || '')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  }

  function buildPeople(){
    const list = roster.map((person, idx) => {
      const { program, school } = resolveProgram(person);
      const seed = stringSeed(person.email || `${person.name}-${idx}`);
      const sid = person.sid || person.profile?.sid || `SID-${1000 + seed}`;
      const verified = typeof person.verified === 'boolean' ? person.verified : seed % 2 === 0;
      const status = needsReview(person) ? 'needs-review' : '';
      const phone = person.profile?.primaryPhone || `(555) 01${seed % 10}${seed % 7}-${1000 + (seed % 900)}`;
      const emergName = person.profile?.emergencyName || `Contact ${person.name?.split(' ')[0] || 'CPNW'}`;
      const emergPhone = person.profile?.emergencyPhone || `(555) 02${seed % 9}${seed % 8}-${1200 + (seed % 700)}`;
      const dob = new Date(1994 + (seed % 8), seed % 12, (seed % 26) + 1);
      return {
        name: person.name,
        email: person.email,
        role: person.role,
        program,
        school,
        sid,
        verified,
        status,
        phone,
        emergName,
        emergPhone,
        dob
      };
    });

    return list.filter((person) => {
      if (!person.program || !person.school) return false;
      if (!isDvsProgram(person.program, person.school)) return false;
      return person.status === 'needs-review';
    });
  }

  function refreshPeople(){
    people = buildPeople();
    updateFilterOptions();
    renderReviews();
  }

  function needsReview(person){
    return CPNW_REQUIREMENTS.some((req, idx) => {
      const status = requirementStatus(person.email, req, `cpnw_${idx + 1}`);
      return status === 'Submitted' || status === 'In Review';
    });
  }

  let people = buildPeople();

  function updateFilterOptions(){
    if (!schoolFilter || !programFilter) return;
    const selectedSchool = String(schoolFilter.value || '');
    const selectedProgram = String(programFilter.value || '');
    const schoolSet = new Set();
    const programSet = new Set();

    people.forEach(person => {
      if (selectedProgram && person.program !== selectedProgram) return;
      if (person.school) schoolSet.add(person.school);
    });

    people.forEach(person => {
      if (selectedSchool && person.school !== selectedSchool) return;
      if (person.program) programSet.add(person.program);
    });

    const schools = Array.from(schoolSet).sort();
    const programs = Array.from(programSet).sort();

    schoolFilter.innerHTML = ['<option value="">All schools</option>', ...schools.map(s => `<option value="${s}">${s}</option>`)].join('');
    programFilter.innerHTML = ['<option value="">All programs</option>', ...programs.map(p => `<option value="${p}">${p}</option>`)].join('');

    if (selectedSchool && schools.includes(selectedSchool)){
      schoolFilter.value = selectedSchool;
    }
    if (selectedProgram && programs.includes(selectedProgram)){
      programFilter.value = selectedProgram;
    }
  }

  let currentStatusChip = 'all';
  let reviewPage = 1;
  let reviewPageSize = Number(reviewPageSizeSelect?.value || 10);
  let sortState = { field:'', dir:'asc' };

  function renderReviews(){
    if (!reviewTableBody) return;
    const q = String(reviewSearch?.value || '').trim().toLowerCase();
    const school = String(schoolFilter?.value || '');
    const program = String(programFilter?.value || '');

    let filtered = people.filter((p) => {
      if (currentStatusChip === 'needs-review' && p.status !== 'needs-review') return false;
      if (school && p.school !== school) return false;
      if (program && p.program !== program) return false;
      if (q && !`${p.name} ${p.sid} ${p.email}`.toLowerCase().includes(q)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const field = sortState.field;
      const dir = sortState.dir === 'desc' ? -1 : 1;
      if (!field){
        return a.name.localeCompare(b.name);
      }
      const valA = (a[field] ?? '').toString().toLowerCase();
      const valB = (b[field] ?? '').toString().toLowerCase();
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return a.name.localeCompare(b.name);
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / reviewPageSize));
    if (reviewPage > totalPages) reviewPage = totalPages;
    const startIdx = (reviewPage - 1) * reviewPageSize;
    const endIdx = Math.min(startIdx + reviewPageSize, total);
    const pageItems = filtered.slice(startIdx, endIdx);

    reviewTableBody.innerHTML = pageItems.map(p => `
      <tr>
        <td class="fw-semibold">${p.name}</td>
        <td>${p.verified ? '✓' : ''}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${p.program}</td>
        <td>${p.school}</td>
        <td>${p.sid}</td>
        <td class="text-end"><button class="btn btn-outline-secondary btn-sm" data-review="${p.sid}">View</button></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="text-body-secondary small">No students need review.</td></tr>';

    if (reviewPageInfo){
      reviewPageInfo.textContent = total ? `Showing ${startIdx + 1}–${endIdx} of ${total}` : 'No results';
    }
    if (reviewPrevPage && reviewNextPage){
      reviewPrevPage.disabled = reviewPage <= 1;
      reviewNextPage.disabled = endIdx >= total;
    }
  }

  [reviewSearch, schoolFilter, programFilter].forEach(el => {
    if (!el) return;
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el === schoolFilter || el === programFilter){
        updateFilterOptions();
      }
      reviewPage = 1;
      renderReviews();
    });
  });

  reviewPageSizeSelect?.addEventListener('change', () => {
    reviewPageSize = Number(reviewPageSizeSelect.value || 10);
    reviewPage = 1;
    renderReviews();
  });

  reviewPrevPage?.addEventListener('click', () => {
    if (reviewPage > 1){
      reviewPage -= 1;
      renderReviews();
    }
  });

  reviewNextPage?.addEventListener('click', () => {
    reviewPage += 1;
    renderReviews();
  });

  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (!field) return;
      if (sortState.field === field){
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      }else{
        sortState = { field, dir:'asc' };
      }
      renderReviews();
    });
  });

  function formatDate(d){
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  }

  function buildAssignments(seed){
    const rows = [];
    for (let i = 0; i < 3; i++){
      const start = new Date(TODAY.getTime() - (60 - i * 12) * DAYS);
      const end = new Date(start.getTime() + 60 * DAYS);
      rows.push({
        location: i % 2 === 0 ? 'CPNW Medical Center' : 'Evergreen Health Clinic',
        start,
        end,
        status: (seed + i) % 3 === 0 ? 'Approved' : ((seed + i) % 3 === 1 ? 'Rejected' : '—')
      });
    }
    return rows;
  }

  function buildRequirementRows(person){
    const submissions = getStudentData(person.email)?.submissions || {};
    return CPNW_REQUIREMENTS.map((req, idx) => {
      const submissionKey = `cpnw_${idx + 1}`;
      const decision = getDecision(person.email, req);
      const status = requirementStatus(person.email, req, submissionKey);
      const submittedAtRaw = submissions?.[submissionKey]?.submittedAt;
      const submittedAt = submittedAtRaw ? new Date(submittedAtRaw) : null;
      const decisionAt = decision?.at ? new Date(decision.at) : null;
      const baseDate = decisionAt instanceof Date && !Number.isNaN(decisionAt.getTime())
        ? decisionAt
        : (submittedAt instanceof Date && !Number.isNaN(submittedAt.getTime()) ? submittedAt : null);
      const expiration = (status === 'Approved' || status === 'Conditionally Approved') && baseDate
        ? new Date(baseDate.getTime() + 365 * DAYS)
        : null;
      const meta = REQUIREMENT_META[req] || { type: 'Forms', frequency: 'Annual' };
      const instructionsHTML = buildRequirementInstructions(req);
      const reviewer = (status === 'Approved' || status === 'Conditionally Approved' || status === 'Rejected') ? 'CPNW Reviewer' : '—';
      return {
        id: submissionKey,
        name: req,
        status,
        expiration,
        due: '',
        score: '',
        type: meta.type,
        frequency: meta.frequency,
        category: 'CPNW Clinical Passport',
        reviewer,
        instructionsHTML
      };
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-review]');
    if (!btn) return;
    const sid = btn.dataset.review;
    const person = people.find(p => p.sid === sid);
    if (!person) return;
    const modalEl = document.getElementById('reviewModal');
    const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl) : null;

    document.getElementById('reviewModalLabel').textContent = person.name;
    document.getElementById('reviewModalSub').textContent = person.email;
    document.getElementById('modalSchool').textContent = person.school;
    document.getElementById('modalProgram').textContent = person.program;
    document.getElementById('modalSid').textContent = person.sid;
    document.getElementById('modalEmail').textContent = person.email;
    document.getElementById('modalPhone').textContent = person.phone || '—';
    document.getElementById('modalEmergName').textContent = person.emergName || '—';
    document.getElementById('modalEmergPhone').textContent = person.emergPhone || '—';
    document.getElementById('modalDob').textContent = person.dob ? person.dob.toLocaleDateString() : '—';
    const data = seedElearningIfMissing(person.email);
    const elearning = data?.elearning || {};
    const elearningCount = Object.values(elearning).filter(v => v && v.passedAt).length;
    const elearningStatus = elearningCount >= 10 ? 'Completed' : 'Completed';
    document.getElementById('modalElearningCount').textContent = `${elearningCount}/10 ${elearningStatus}`;
    currentStudentEmail = person.email;
    currentMessages = [];
    currentReqId = '';

    const assignBody = document.getElementById('assignTableBody');
    const assignments = buildAssignments(stringSeed(person.email));
    assignBody.innerHTML = assignments.map(a => `
      <tr>
        <td>${a.location}</td>
        <td>${formatDate(a.start)}</td>
        <td>${formatDate(a.end)}</td>
        <td>${a.status}</td>
      </tr>
    `).join('');

    const reqBody = document.getElementById('reqTableBody');
    const reqRows = buildRequirementRows(person);
    reqBody.innerHTML = reqRows.map(r => `
      <tr>
        <td><button type="button" class="btn btn-link p-0 req-detail-btn text-start w-100" data-req-id="${r.id}">${r.name}</button></td>
        <td>${statusBadge(r.status)}</td>
        <td>${formatDate(r.expiration)}</td>
        <td>${r.due || ''}</td>
        <td>${r.score || ''}</td>
        <td>${r.type}</td>
        <td>${r.frequency}</td>
        <td>${r.category}</td>
        <td>${r.reviewer}</td>
      </tr>
    `).join('');

    modal?.show();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.req-detail-btn');
    if (!btn) return;
    const reqId = btn.dataset.reqId || '';
    const reviewModalEl = document.getElementById('reviewModal');
    const reviewModalInstance = reviewModalEl ? bootstrap.Modal.getInstance(reviewModalEl) || new bootstrap.Modal(reviewModalEl) : null;
    const wasOpen = reviewModalEl?.classList.contains('show');
    if (wasOpen) reviewModalInstance?.hide();

    const reqRows = currentStudentEmail ? buildRequirementRows({ email: currentStudentEmail }) : [];
    const info = reqRows.find(r => r.id === reqId);
    if (info){
      openRequirementDetail(info);
    }

    detailModalEl?.addEventListener('hidden.bs.modal', () => {
      if (wasOpen) reviewModalInstance?.show();
    }, { once: true });
  });

  document.addEventListener('change', (e) => {
    if (!e.target.matches('input[name="studentSubmission"]')) return;
    [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
    const targetId = e.target.dataset.submissionTarget;
    if (targetId){
      document.getElementById(targetId)?.classList.remove('d-none');
    }
  });

  [hepBOptionTiter, hepBOptionNoTiter].forEach(el => el?.addEventListener('change', updateHepBMainOption));
  [hepBReasonNonConverter, hepBReasonSeriesInProcess, hepBReasonHistory, hepBReasonHealth].forEach(el => el?.addEventListener('change', updateHepBReason));
  [hepBNcSeries1Two, hepBNcSeries1Three].forEach(el => el?.addEventListener('change', () => {
    setSeriesFields(hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, hepBNcSeries1Three?.checked);
  }));
  [hepBNcSeries2Two, hepBNcSeries2Three].forEach(el => el?.addEventListener('change', () => {
    setSeriesFields(hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, hepBNcSeries2Three?.checked);
  }));
  [hepBIpSeries1Two, hepBIpSeries1Three].forEach(el => el?.addEventListener('change', () => {
    setSeriesFields(hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields, hepBIpSeries1Three?.checked);
  }));
  hepBHealthReasonInput?.addEventListener('input', updateHepBHealthReasonCount);
  criminalDisclosureDate0?.addEventListener('input', updateDisclosureAddVisibility);
  criminalDisclosureAdd?.addEventListener('click', addDisclosureDateField);
  filesEl?.addEventListener('change', showSelectedFiles);

  elearningLaunchBtn?.addEventListener('click', () => {
    alert('This is a demo. In a real scenario, the eLearning module would open in a new tab and the score recorded automatically.');
  });

  criminalDisclosureDownload?.addEventListener('click', () => {
    const content = [
      'CPNW Criminal History Disclosure Form',
      '',
      'Student name:',
      'Program:',
      'School:',
      '',
      'Disclosure details:',
      '',
      'Signature:',
      'Date:'
    ].join('\\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'CPNW-Criminal-History-Disclosure-Form.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  hepBSeriesInProcessDownload?.addEventListener('click', () => {
    const content = [
      'CPNW Hepatitis B Series In Process Form',
      '',
      'Student name:',
      'Program:',
      '',
      'Series details:',
      '',
      'Signature:',
      'Date:'
    ].join('\\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'CPNW-HepB-Series-In-Process.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  msgSend?.addEventListener('click', () => {
    if (!currentReqId || !currentStudentEmail){
      setAlert(detailError, 'Missing requirement context.');
      return;
    }
    const recipients = [];
    if (msgToEducation?.checked) recipients.push('Education');
    if (msgToHealthcare?.checked) recipients.push('Healthcare');
    if (msgToCpnw?.checked) recipients.push('CPNW Reviewer');
    if (!recipients.length){
      setAlert(detailError, 'Please choose a recipient.');
      return;
    }
    const body = (msgInput?.value || '').trim();
    if (!body){
      setAlert(detailError, 'Please enter a message.');
      return;
    }
    const data = getStudentData(currentStudentEmail);
    data.messages = data.messages && typeof data.messages === 'object' ? data.messages : {};
    data.messages[currentReqId] = Array.isArray(data.messages[currentReqId]) ? data.messages[currentReqId] : [];
    const msg = { from:'CPNW Reviewer', to: recipients, body, at: new Date().toLocaleString() };
    data.messages[currentReqId].push(msg);
    try{
      localStorage.setItem(`cpnw-student-data-${String(currentStudentEmail || '').toLowerCase()}`, JSON.stringify(data));
    }catch{}
    currentMessages.push(msg);
    if (msgInput) msgInput.value = '';
    [msgToEducation, msgToHealthcare, msgToCpnw].forEach(el => { if (el) el.checked = false; });
    setAlert(detailError, '');
    setAlert(detailSaved, 'Message sent.');
    renderMessages();
  });

  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('decision-radio')) return;
    const requiresReason = e.target.hasAttribute('data-requires-reason');
    if (decisionReasonWrap){
      decisionReasonWrap.classList.toggle('d-none', !requiresReason);
    }
  });

  decisionSave?.addEventListener('click', () => {
    if (!currentStudentEmail || !currentReqName){
      setAlert(detailError, 'Missing requirement context.');
      return;
    }
    const status =
      decApprove?.checked ? 'Approved' :
      decConditional?.checked ? 'Conditionally Approved' :
      decReject?.checked ? 'Rejected' :
      '';
    const reason = (decisionReason?.value || '').trim();
    if ((status === 'Conditionally Approved' || status === 'Rejected') && !reason){
      setAlert(detailError, 'Please enter a reason for conditional approval or rejection.');
      return;
    }
    if (!status){
      setAlert(detailError, 'Select a decision before saving.');
      return;
    }

    saveDecision(currentStudentEmail, currentReqName, {
      status,
      reason,
      at: new Date().toISOString()
    });

    setAlert(detailError, '');
    if (decisionSaved) decisionSaved.classList.remove('d-none');

    const reqRows = buildRequirementRows({ email: currentStudentEmail });
    const updated = reqRows.find(r => r.id === currentReqId);
    if (updated){
      renderDetailMeta(updated);
    }

    const reqBody = document.getElementById('reqTableBody');
    if (reqBody){
      reqBody.innerHTML = reqRows.map(r => `
        <tr>
          <td><button type="button" class="btn btn-link p-0 req-detail-btn text-start w-100" data-req-id="${r.id}">${r.name}</button></td>
          <td>${statusBadge(r.status)}</td>
          <td>${formatDate(r.expiration)}</td>
          <td>${r.due || ''}</td>
          <td>${r.score || ''}</td>
          <td>${r.type}</td>
          <td>${r.frequency}</td>
          <td>${r.category}</td>
          <td>${r.reviewer}</td>
        </tr>
      `).join('');
    }

    refreshPeople();
  });

  submitBtn?.setAttribute('disabled', 'true');

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-download-file]');
    if (!btn) return;
    alert('This is a demo. Uploaded documents would download in a real scenario.');
  });

  updateFilterOptions();
  renderReviews();
})();
