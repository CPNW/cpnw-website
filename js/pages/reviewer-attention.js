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
  const reqFilterWrap = document.getElementById('reviewerReqFilters');
  const reqFilterHint = document.getElementById('reviewerReqFilterHint');

  const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];
  const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;

  const DVS_PACKAGES = new Set(['sp-13', 'sp-14', 'my-17', 'my-18']);
  const PROGRAM_PACKAGES = [
    { school: 'CPNW University', program: 'ADN', packageId: 'sp-13' },
    { school: 'CPNW University', program: 'BSN', packageId: 'sp-11' },
    { school: 'CPNW University', program: 'SurgTech', packageId: 'sp-12' },
    { school: 'CPNW University', program: 'RespCare', packageId: 'sp-14' },
    { school: 'CPNW Education', program: 'ADN', packageId: 'sp-12' },
    { school: 'CPNW Education', program: 'BSN', packageId: 'my-17' },
    { school: 'CPNW Education', program: 'RadTech', packageId: 'sp-11' },
    { school: 'CPNW Education', program: 'MedAssist', packageId: 'my-18' },
    { school: 'CPNW Education', program: 'DMS', packageId: 'sp-13' }
  ];
  const dvsPrograms = PROGRAM_PACKAGES.filter(p => DVS_PACKAGES.has(p.packageId));
  function normalizeProgramName(name){
    const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.includes('surg')) return 'SurgTech';
    if (normalized.includes('rad')) return 'RadTech';
    if (normalized.includes('resp')) return 'RespCare';
    if (normalized.includes('sonography') || normalized.includes('sono') || normalized.includes('dms')) return 'DMS';
    if (normalized.includes('medassistant') || normalized.includes('medassist')) return 'MedAssist';
    if (normalized.includes('bsn')) return 'BSN';
    if (normalized.includes('adn')) return 'ADN';
    return String(name || '').trim();
  }

  function normalizeSchoolName(name){
    return String(name || '').trim();
  }

  const dvsProgramKeys = new Set(
    dvsPrograms.map(p => `${normalizeSchoolName(p.school)}::${normalizeProgramName(p.program)}`)
  );

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
  const subRadios = document.querySelectorAll('input[name="studentSubmission"]');
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
  const varicellaSubmissionWrap = document.getElementById('varicellaSubmissionWrap');
  const varicellaRadios = document.querySelectorAll('input[name="varicellaSubmission"]');
  const varicellaOptionMilitary = document.getElementById('varicellaOptionMilitary');
  const varicellaOptionVaccination = document.getElementById('varicellaOptionVaccination');
  const varicellaOptionTiter = document.getElementById('varicellaOptionTiter');
  const varicellaVaccinationFields = document.getElementById('varicellaVaccinationFields');
  const varicellaDose1Date = document.getElementById('varicellaDose1Date');
  const varicellaDose2Date = document.getElementById('varicellaDose2Date');
  const varicellaTiterFields = document.getElementById('varicellaTiterFields');
  const varicellaTiterDate = document.getElementById('varicellaTiterDate');
  const varicellaTiterPositive = document.getElementById('varicellaTiterPositive');
  const varicellaTiterNegative = document.getElementById('varicellaTiterNegative');
  const mmrSubmissionWrap = document.getElementById('mmrSubmissionWrap');
  const mmrRadios = document.querySelectorAll('input[name="mmrSubmission"]');
  const mmrOptionMilitary = document.getElementById('mmrOptionMilitary');
  const mmrOptionVaccination = document.getElementById('mmrOptionVaccination');
  const mmrOptionTiter = document.getElementById('mmrOptionTiter');
  const mmrVaccinationFields = document.getElementById('mmrVaccinationFields');
  const mmrDose1Date = document.getElementById('mmrDose1Date');
  const mmrDose2Date = document.getElementById('mmrDose2Date');
  const mmrTiterFields = document.getElementById('mmrTiterFields');
  const mmrMeaslesGroup = mmrSubmissionWrap?.querySelector('[data-mmr-group="measles"]') || null;
  const mmrMumpsGroup = mmrSubmissionWrap?.querySelector('[data-mmr-group="mumps"]') || null;
  const mmrRubellaGroup = mmrSubmissionWrap?.querySelector('[data-mmr-group="rubella"]') || null;
  const influenzaSubmissionWrap = document.getElementById('influenzaSubmissionWrap');
  const influenzaVaccinations = document.getElementById('influenzaVaccinations');
  const influenzaAdd = document.getElementById('influenzaAdd');
  const influenzaDate0 = document.getElementById('influenzaDate0');
  const influenzaLocation0 = document.getElementById('influenzaLocation0');
  const tuberculinSubmissionWrap = document.getElementById('tuberculinSubmissionWrap');
  const tuberculinOptionTwoStep = document.getElementById('tuberculinOptionTwoStep');
  const tuberculinOptionIgra = document.getElementById('tuberculinOptionIgra');
  const tuberculinOptionHistory = document.getElementById('tuberculinOptionHistory');
  const tuberculinTwoStepFields = document.getElementById('tuberculinTwoStepFields');
  const tuberculinIgraFields = document.getElementById('tuberculinIgraFields');
  const tuberculinHistoryFields = document.getElementById('tuberculinHistoryFields');
  const tuberculinTest1Place = document.getElementById('tuberculinTest1Place');
  const tuberculinTest1Read = document.getElementById('tuberculinTest1Read');
  const tuberculinTest1Mm = document.getElementById('tuberculinTest1Mm');
  const tuberculinTest1Neg = document.getElementById('tuberculinTest1Neg');
  const tuberculinTest1Pos = document.getElementById('tuberculinTest1Pos');
  const tuberculinTest2Place = document.getElementById('tuberculinTest2Place');
  const tuberculinTest2Read = document.getElementById('tuberculinTest2Read');
  const tuberculinTest2Mm = document.getElementById('tuberculinTest2Mm');
  const tuberculinTest2Neg = document.getElementById('tuberculinTest2Neg');
  const tuberculinTest2Pos = document.getElementById('tuberculinTest2Pos');
  const tuberculinIgraDate = document.getElementById('tuberculinIgraDate');
  const tuberculinIgraNeg = document.getElementById('tuberculinIgraNeg');
  const tuberculinIgraPos = document.getElementById('tuberculinIgraPos');
  const tuberculinChestDate = document.getElementById('tuberculinChestDate');
  const tuberculinChestNeg = document.getElementById('tuberculinChestNeg');
  const tuberculinChestPos = document.getElementById('tuberculinChestPos');
  const tuberculinDownload = document.getElementById('tuberculinDownload');
  const covidSubmissionWrap = document.getElementById('covidSubmissionWrap');
  const covidNoVaccination = document.getElementById('covidNoVaccination');
  const covidDetails = document.getElementById('covidDetails');
  const covidManufacturer = document.getElementById('covidManufacturer');
  const covidDoseList = document.getElementById('covidDoseList');
  const covidDose1 = document.getElementById('covidDose1');
  const covidAddBooster = document.getElementById('covidAddBooster');
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
  let influenzaExtraCount = 0;
  let covidExtraCount = 0;
  let mmrBoosterCounts = { measles: 0, mumps: 0, rubella: 0 };
  const selectedReqs = new Set();

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
    if (requirementsStore?.setStatus){
      requirementsStore.setStatus({ email }, reqName, record?.status || '', {
        source: 'decision',
        updatedAt: record?.at || new Date().toISOString()
      });
    }
  }

  function seededStatus(email, reqLabel){
    const seed = Array.from(String(email)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const reqSeed = seed + Array.from(String(reqLabel)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    if (/watch/i.test(reqLabel)){
      const mod = reqSeed % 20;
      if (mod < 3) return 'In Review';
      if (mod < 7) return 'Submitted';
      return 'Not Submitted';
    }
    const mod = reqSeed % 20;
    if (mod < 4) return 'In Review';
    if (mod < 9) return 'Submitted';
    return 'Not Submitted';
  }

  function requirementStatus(email, reqName, submissionKey){
    if (requirementsStore){
      const stored = requirementsStore.getRecord(requirementsStore.resolveStudentKey({ email }), reqName);
      if (stored?.status) return stored.status;
    }
    const decision = getDecision(email, reqName);
    if (decision?.status){
      requirementsStore?.setStatus({ email }, reqName, decision.status, {
        source: 'decision',
        updatedAt: decision.at || new Date().toISOString()
      });
      return decision.status;
    }
    const submissions = getStudentData(email)?.submissions || {};
    if (submissions && submissions[submissionKey]){
      requirementsStore?.setSubmission({ email }, reqName, {
        updatedAt: submissions[submissionKey].submittedAt || new Date().toISOString()
      });
      return 'Submitted';
    }
    if (requirementsStore){
      return requirementsStore.getStatus({ email }, reqName, { category: 'CPNW Clinical Passport' });
    }
    return seededStatus(email, reqName);
  }

  function reqNeedsReview(email, reqName, submissionKey){
    const status = requirementStatus(email, reqName, submissionKey);
    return status === 'Submitted';
  }

  function statusBadge(status){
    const s = String(status || '').toLowerCase();
    if (s === 'needs-review') return '<span class="badge text-bg-warning text-dark">Needs review</span>';
    if (s === 'submitted') return '<span class="badge text-bg-info text-dark">Submitted</span>';
    if (s === 'in review') return '<span class="badge text-bg-warning text-dark">In Review</span>';
    if (s === 'approved') return '<span class="badge text-bg-success">Approved</span>';
    if (s === 'conditionally approved') return '<span class="badge text-bg-primary">Conditionally Approved</span>';
    if (s === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
    if (s === 'expired') return '<span class="badge text-bg-dark">Expired</span>';
    if (s === 'expiring' || s === 'expiring soon') return '<span class="badge text-bg-warning text-dark">Expiring</span>';
    if (s === 'declination') return '<span class="badge text-bg-danger-subtle text-danger">Declination</span>';
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

  function isVaricellaRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('varicella');
  }

  function isMmrRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('measles') && label.includes('mumps') && label.includes('rubella');
  }

  function isInfluenzaRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('influenza');
  }

  function isTuberculinRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('tuberculin');
  }

  function isBlsRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('bls') && label.includes('provider');
  }

  function isCovidRequirement(name){
    const label = String(name || '').toLowerCase();
    return label.includes('covid');
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
    if (isVaricellaRequirement(name)){
      return [
        '<p>You must meet the Varicella requirement by either providing two vaccination records or proof of immunity through a titer blood draw.</p>',
        '<p><strong>Note:</strong> A verbal or written history of having had chickenpox is not accepted as proof of immunity.</p>',
        '<p class="fw-semibold mb-1">Option 1: Vaccination Dates</p>',
        '<ul><li>Submit documentation showing two doses of the Varicella vaccine.</li></ul>',
        '<p class="fw-semibold mb-1">Option 2: Proof of Immunity by Titer</p>',
        '<ul><li>Submit a positive Varicella titer result from a blood draw.</li></ul>',
        '<p class="mb-0"><strong>Important:</strong> If the titer result is negative or non-immune, you must receive a booster dose.</p>'
      ].join('');
    }
    if (isMmrRequirement(name)){
      return [
        '<p>The MMR (Measles, Mumps, and Rubella) or MMRV (Measles, Mumps, Rubella, and Varicella) vaccine is required for clinical participation. You meet this requirement by providing vaccination records and proof of immunity through titers.</p>',
        '<p class="fw-semibold mb-1">Option 1: Vaccination</p>',
        '<p>Submit: Two doses of the MMR or MMRV vaccine.</p>',
        '<p class="fw-semibold mb-1">Option 2: Proof of Immunity by Titers</p>',
        '<p>Submit lab results showing positive titers for each of the following: Measles (Rubeola), Mumps, Rubella.</p>',
        '<p>Most labs will draw one blood sample and report three separate results (plus Varicella, if tested).</p>',
        '<p class="mb-0"><strong>Important:</strong> If any one of the three titers are negative or non-immune, you must receive a booster dose for that component.</p>'
      ].join('');
    }
    if (isInfluenzaRequirement(name)){
      return [
        '<p class="fw-semibold mb-1">CPNW Influenza (flu)</p>',
        '<p>Vaccines received prior to August 1st of the current year will expire on October 1st of the current year. Vaccines received after August 1st of the current year will expire on October 1st of the following year.</p>',
        '<p>An annual influenza vaccine is required for each current flu season, typically due by the end of September, to remain compliant for clinical participation.</p>',
        '<p class="fw-semibold mb-1">Vaccination Documentation</p>',
        '<p>Submit a record showing you received the current season’s flu vaccine.</p>',
        '<p class="mb-1">Accepted forms of vaccination include:</p>',
        '<ul>',
        '<li>Flu vaccine (injectable)</li>',
        '<li>Nasal spray flu vaccine, administered in-office by a healthcare professional</li>',
        '<li>Home/self-administered nasal spray options are not accepted.</li>',
        '</ul>',
        '<p class="mb-1">Your documentation must include:</p>',
        '<ul>',
        '<li>The date of vaccination</li>',
        '<li>Location you received the vaccination (CVS, provider’s office, clinic)</li>',
        '</ul>'
      ].join('');
    }
    if (isTuberculinRequirement(name)){
      return [
        '<p>To meet the TB requirement, you must provide proof of screening results that are no older than one year from the start date of your program.</p>',
        '<p>Proof of screening is completed by either a two-step TB skin test or a TB blood test called an Interferon Gamma Release Assays (IGRA) to confirm you do not have active tuberculosis.</p>',
        '<p class="fw-semibold mb-1">Option 1: 2-Step TB Skin Test</p>',
        '<p>The two-step TB skin test involves two separate tests administered 1–3 weeks apart, requiring a total of four office visits and approximately three weeks to complete.</p>',
        '<p class="fw-semibold mb-1">Option 2: TB Blood Test</p>',
        '<p>The TB blood test (IGRA) is a single blood draw and typically requires only one visit. It is an acceptable alternative to the skin test.</p>',
        '<p class="fw-semibold mb-1">Option 3: History of or a new positive result on either test</p>',
        '<p>You must complete a medical evaluation by a licensed healthcare provider.</p>',
        '<p>You are required to upload all applicable documentation, including provider notes, diagnostic exams, chest x-rays, and/or treatment records.</p>',
        '<p class="mb-0">If you have a history of positive TB test results, you must also complete and upload the Tuberculosis Symptom Screening form attached to this requirement.</p>'
      ].join('');
    }
    if (isBlsRequirement(name)){
      return [
        '<p>All students and faculty must maintain a current American Heart Association (AHA) BLS certification. You may meet this requirement through one of the following AHA-approved options:</p>',
        '<ul>',
        '<li>AHA BLS Provider Course (fully in-person)</li>',
        '<li>AHA HeartCode® BLS Provider Course (online + in-person skills check)</li>',
        '<li>AHA BLS Resuscitation Quality Improvement (RQI) Program</li>',
        '</ul>',
        '<p>Upload the full PDF that shows both your next RQI date and the 2-year certification date at the bottom.</p>',
        '<p class="fw-semibold mb-1">Requirements</p>',
        '<p>Each of these certification options include training in:</p>',
        '<p>Adult, child, and infant CPR, AED use, choking response, single- and multi-rescuer scenarios.</p>',
        '<p>Provide Date of Issue as shown on card or eCard.</p>',
        '<p>Upload your current course card or eCard.</p>',
        '<p class="mb-0">No other providers or courses are acceptable, outside of those mentioned above.</p>'
      ].join('');
    }
    if (isCovidRequirement(name)){
      return [
        '<p>All students and faculty are required to upload their full COVID-19 vaccination history.</p>',
        '<p>Please note: Some clinical sites may update their policies and require an annual COVID-19 vaccination/booster as a condition of participation.</p>',
        '<p class="fw-semibold mb-1">Option 1: No Vaccination History</p>',
        '<p>If you have never received a COVID-19 vaccine, check the option labeled “Not Applicable”.</p>',
        '<p class="fw-semibold mb-1">Option 2: Vaccination Documentation</p>',
        '<p>Submit all available vaccination record that includes:</p>',
        '<ul>',
        '<li>Vaccine manufacturer (e.g., Pfizer, Moderna, Johnson & Johnson)</li>',
        '<li>Dates associated with receiving either a one-dose or two-dose series</li>',
        '<li>The date(s) of administration, including subsequent boosters, if applicable</li>',
        '</ul>'
      ].join('');
    }
    return `<p>Upload the required documentation for ${name}.</p>`;
  }

  function applySubmissionTemplate(reqName){
    const isTdap = isTdapRequirement(reqName);
    const isHepB = isHepBRequirement(reqName);
    const isCriminal = isCriminalDisclosureRequirement(reqName);
    const isVaricella = isVaricellaRequirement(reqName);
    const isMmr = isMmrRequirement(reqName);
    const isInfluenza = isInfluenzaRequirement(reqName);
    const isTuberculin = isTuberculinRequirement(reqName);
    const isBls = isBlsRequirement(reqName);
    const isCovid = isCovidRequirement(reqName);
    if (subCompletedLabel) subCompletedLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedLabel;
    if (subSeriesLabel) subSeriesLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesLabel;
    if (subOtherLabel) subOtherLabel.textContent = defaultSubOtherLabel;
    if (subCompletedDateLabel) subCompletedDateLabel.textContent = isTdap ? 'Initial Tdap date' : (isBls ? 'Date of Issue' : defaultSubCompletedDateLabel);
    if (subSeriesStartLabel) subSeriesStartLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesStartLabel;
    if (subSeriesDueLabel) subSeriesDueLabel.textContent = defaultSubSeriesDueLabel;
    subOtherWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isBls || isCovid);
    subSeriesDueWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isBls || isCovid);
    submissionOptionsWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isBls || isCovid);
    criminalDisclosureWrap?.classList.toggle('d-none', !isCriminal);
    criminalDisclosureDownloadWrap?.classList.toggle('d-none', !isCriminal);
    hepBSubmissionWrap?.classList.toggle('d-none', !isHepB);
    varicellaSubmissionWrap?.classList.toggle('d-none', !isVaricella);
    mmrSubmissionWrap?.classList.toggle('d-none', !isMmr);
    influenzaSubmissionWrap?.classList.toggle('d-none', !isInfluenza);
    tuberculinSubmissionWrap?.classList.toggle('d-none', !isTuberculin);
    covidSubmissionWrap?.classList.toggle('d-none', !isCovid);
    if (isTdap){
      subCompletedFields?.classList.remove('d-none');
      subSeriesFields?.classList.remove('d-none');
      subOtherFields?.classList.add('d-none');
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isCriminal){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      resetDisclosureFields();
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isHepB){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      resetHepBFields();
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isVaricella){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      resetVaricellaFields();
      updateVaricellaOption();
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isMmr){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      resetMmrFields();
      updateMmrOption();
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isInfluenza){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      resetInfluenzaFields();
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isTuberculin){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      resetTuberculinFields();
      updateTuberculinOption();
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isBls){
      subCompletedFields?.classList.remove('d-none');
      subSeriesFields?.classList.add('d-none');
      subOtherFields?.classList.add('d-none');
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
    }else if (isCovid){
      [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      resetCovidFields();
      updateCovidOption();
    }else{
      criminalDisclosureWrap?.classList.add('d-none');
      criminalDisclosureDownloadWrap?.classList.add('d-none');
      hepBSubmissionWrap?.classList.add('d-none');
      varicellaSubmissionWrap?.classList.add('d-none');
      mmrSubmissionWrap?.classList.add('d-none');
      influenzaSubmissionWrap?.classList.add('d-none');
      tuberculinSubmissionWrap?.classList.add('d-none');
      covidSubmissionWrap?.classList.add('d-none');
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

  function resetVaricellaFields(){
    if (varicellaSubmissionWrap){
      const inputs = varicellaSubmissionWrap.querySelectorAll('input');
      inputs.forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox'){
          el.checked = false;
        }else{
          el.value = '';
        }
      });
    }
    varicellaVaccinationFields?.classList.add('d-none');
    varicellaTiterFields?.classList.add('d-none');
  }

  function resetMmrFields(){
    if (mmrSubmissionWrap){
      const inputs = mmrSubmissionWrap.querySelectorAll('input');
      inputs.forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox'){
          el.checked = false;
        }else{
          el.value = '';
        }
      });
    }
    const groups = [mmrMeaslesGroup, mmrMumpsGroup, mmrRubellaGroup];
    groups.forEach(group => {
      if (!group) return;
      const rows = group.querySelectorAll('[data-mmr-row]');
      rows.forEach((row, index) => {
        if (index > 0) row.remove();
      });
      const addBtn = group.querySelector('[data-mmr-add]');
      addBtn?.classList.add('d-none');
    });
    mmrBoosterCounts = { measles: 0, mumps: 0, rubella: 0 };
    mmrVaccinationFields?.classList.add('d-none');
    mmrTiterFields?.classList.add('d-none');
  }

  function resetInfluenzaFields(){
    if (influenzaDate0) influenzaDate0.value = '';
    if (influenzaLocation0) influenzaLocation0.value = '';
    if (influenzaVaccinations){
      const extras = influenzaVaccinations.querySelectorAll('[data-influenza-extra]');
      extras.forEach(el => el.remove());
    }
    influenzaExtraCount = 0;
  }

  function resetTuberculinFields(){
    if (tuberculinSubmissionWrap){
      const inputs = tuberculinSubmissionWrap.querySelectorAll('input');
      inputs.forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox'){
          el.checked = false;
        }else{
          el.value = '';
        }
      });
    }
    tuberculinTwoStepFields?.classList.add('d-none');
    tuberculinIgraFields?.classList.add('d-none');
    tuberculinHistoryFields?.classList.add('d-none');
  }

  function resetCovidFields(){
    if (covidNoVaccination) covidNoVaccination.checked = false;
    if (covidManufacturer) covidManufacturer.value = '';
    if (covidDose1) covidDose1.value = '';
    if (covidDoseList){
      const extras = covidDoseList.querySelectorAll('[data-covid-extra]');
      extras.forEach(el => el.remove());
    }
    covidExtraCount = 0;
    covidDetails?.classList.remove('d-none');
  }

  function updateVaricellaOption(){
    const showVaccination = !!varicellaOptionVaccination?.checked;
    const showTiter = !!varicellaOptionTiter?.checked;
    varicellaVaccinationFields?.classList.toggle('d-none', !showVaccination);
    varicellaTiterFields?.classList.toggle('d-none', !showTiter);
  }

  function updateMmrOption(){
    const showVaccination = !!mmrOptionVaccination?.checked;
    const showTiter = !!mmrOptionTiter?.checked;
    mmrVaccinationFields?.classList.toggle('d-none', !showVaccination);
    mmrTiterFields?.classList.toggle('d-none', !showTiter);
    if (showTiter){
      updateMmrBoosterVisibility('measles');
      updateMmrBoosterVisibility('mumps');
      updateMmrBoosterVisibility('rubella');
    }
  }

  function mmrGroupFor(type){
    if (type === 'measles') return mmrMeaslesGroup;
    if (type === 'mumps') return mmrMumpsGroup;
    if (type === 'rubella') return mmrRubellaGroup;
    return null;
  }

  function updateMmrBoosterVisibility(type){
    const group = mmrGroupFor(type);
    if (!group) return;
    const addBtn = group.querySelector('[data-mmr-add]');
    if (!addBtn) return;
    const rows = Array.from(group.querySelectorAll('[data-mmr-row]'));
    const last = rows[rows.length - 1];
    if (!last){
      addBtn.classList.add('d-none');
      return;
    }
    const hasNegative = !!last.querySelector('input[type="radio"][value="neg"]:checked');
    addBtn.classList.toggle('d-none', !hasNegative);
  }

  function addMmrBoosterRow(type){
    const group = mmrGroupFor(type);
    if (!group) return;
    const count = (mmrBoosterCounts[type] || 0) + 1;
    mmrBoosterCounts = { ...mmrBoosterCounts, [type]: count };
    const cap = type.charAt(0).toUpperCase() + type.slice(1);
    const row = document.createElement('div');
    row.className = 'row g-2 mb-2';
    row.dataset.mmrRow = 'true';
    row.innerHTML = `
      <div class="col-12 col-md-5">
        <input type="date" class="form-control" id="mmr${cap}Date${count}">
      </div>
      <div class="col-12 col-md-7">
        <div class="form-label small mb-1">Result</div>
        <div class="d-flex flex-wrap gap-3">
          <div class="form-check">
            <input class="form-check-input" type="radio" name="mmr${cap}Result${count}" id="mmr${cap}Neg${count}" value="neg">
            <label class="form-check-label" for="mmr${cap}Neg${count}">Neg/Equivalent</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="mmr${cap}Result${count}" id="mmr${cap}Pos${count}" value="pos">
            <label class="form-check-label" for="mmr${cap}Pos${count}">Pos</label>
          </div>
        </div>
      </div>
    `;
    const addBtn = group.querySelector('[data-mmr-add]');
    group.insertBefore(row, addBtn);
    row.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', () => updateMmrBoosterVisibility(type));
    });
    addBtn?.classList.add('d-none');
  }

  function updateTuberculinOption(){
    const showTwoStep = !!tuberculinOptionTwoStep?.checked;
    const showIgra = !!tuberculinOptionIgra?.checked;
    const showHistory = !!tuberculinOptionHistory?.checked;
    tuberculinTwoStepFields?.classList.toggle('d-none', !showTwoStep);
    tuberculinIgraFields?.classList.toggle('d-none', !showIgra);
    tuberculinHistoryFields?.classList.toggle('d-none', !showHistory);
  }

  function updateCovidOption(){
    const hideDetails = !!covidNoVaccination?.checked;
    covidDetails?.classList.toggle('d-none', hideDetails);
    if (hideDetails){
      if (covidManufacturer) covidManufacturer.value = '';
      if (covidDose1) covidDose1.value = '';
      if (covidDoseList){
        const extras = covidDoseList.querySelectorAll('[data-covid-extra]');
        extras.forEach(el => el.remove());
      }
      covidExtraCount = 0;
    }
  }

  function addInfluenzaField(){
    if (!influenzaVaccinations) return;
    influenzaExtraCount += 1;
    const dateId = `influenzaDate${influenzaExtraCount}`;
    const locationId = `influenzaLocation${influenzaExtraCount}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'col-12';
    wrapper.dataset.influenzaExtra = 'true';
    wrapper.innerHTML = `
      <div class="row g-2">
        <div class="col-12 col-md-6">
          <label class="form-label small mb-1" for="${dateId}">Vaccination date</label>
          <input type="date" class="form-control" id="${dateId}">
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label small mb-1" for="${locationId}">Location received</label>
          <input type="text" class="form-control" id="${locationId}" placeholder="Clinic or pharmacy name">
        </div>
      </div>
    `;
    influenzaVaccinations.appendChild(wrapper);
  }

  function addCovidBooster(){
    if (!covidDoseList) return;
    covidExtraCount += 1;
    const doseNumber = covidExtraCount + 1;
    const fieldId = `covidDose${doseNumber}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'col-12 col-md-6';
    wrapper.dataset.covidExtra = 'true';
    wrapper.innerHTML = `
      <label class="form-label small mb-1" for="${fieldId}">Dose ${doseNumber} date</label>
      <input type="date" class="form-control" id="${fieldId}">
    `;
    covidDoseList.appendChild(wrapper);
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

    [subCompletedDate, subSeriesStart, subSeriesDue, subOtherNotes, varicellaDose1Date, varicellaDose2Date, varicellaTiterDate, mmrDose1Date, mmrDose2Date, influenzaDate0, influenzaLocation0].forEach(el => {
      if (el) el.value = '';
    });
    [varicellaTiterPositive, varicellaTiterNegative].forEach(el => { if (el) el.checked = false; });
    varicellaRadios.forEach(r => { r.checked = false; });
    mmrRadios.forEach(r => { r.checked = false; });
    resetVaricellaFields();
    resetMmrFields();
    resetInfluenzaFields();
    resetTuberculinFields();
    resetCovidFields();

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
    let statusHint = savedDecision?.status || '';
    if (!statusHint && requirementsStore){
      const stored = requirementsStore.getRecord(
        requirementsStore.resolveStudentKey({ email: currentStudentEmail }),
        currentReqName
      );
      statusHint = stored?.status || '';
    }
    if (statusHint){
      const status = String(statusHint || '').toLowerCase();
      if (decApprove) decApprove.checked = status === 'approved';
      if (decConditional) decConditional.checked = status === 'conditionally approved';
      if (decReject) decReject.checked = status === 'rejected';
      if (decisionReason) decisionReason.value = savedDecision?.reason || '';
      decisionReasonWrap?.classList.toggle('d-none', !(decConditional?.checked || decReject?.checked));
    }

    const savedSubmission = savedDecision?.submission || null;
    if (savedSubmission){
      if (savedSubmission.mode && !isCriminalDisclosureRequirement(currentReqName) && !isHepBRequirement(currentReqName)){
        const subRadio = Array.from(subRadios).find(r => r.value === savedSubmission.mode);
        if (subRadio){
          subRadio.checked = true;
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          const targetId = subRadio.dataset.submissionTarget;
          if (targetId) document.getElementById(targetId)?.classList.remove('d-none');
        }
      }
      if (subCompletedDate) subCompletedDate.value = savedSubmission.completedDate || '';
      if (subSeriesStart) subSeriesStart.value = savedSubmission.seriesStart || '';
      if (subSeriesDue) subSeriesDue.value = savedSubmission.seriesDue || '';
      if (subOtherNotes) subOtherNotes.value = savedSubmission.otherNotes || '';

      if (savedSubmission.disclosureDates && criminalDisclosureDates){
        resetDisclosureFields();
        const dates = savedSubmission.disclosureDates.filter(Boolean);
        if (criminalDisclosureDate0 && dates[0]) criminalDisclosureDate0.value = dates[0];
        dates.slice(1).forEach(date => {
          addDisclosureDateField();
          const inputs = criminalDisclosureDates.querySelectorAll('[data-disclosure-extra] input[type="date"]');
          const last = inputs[inputs.length - 1];
          if (last) last.value = date;
        });
        updateDisclosureAddVisibility();
      }

      if (savedSubmission.hepB){
        resetHepBFields();
        if (savedSubmission.hepB.mainOption === 'titer'){
          hepBOptionTiter.checked = true;
          updateHepBMainOption();
        }else if (savedSubmission.hepB.mainOption === 'notiter'){
          hepBOptionNoTiter.checked = true;
          updateHepBMainOption();
        }
        if (hepBTiterDate) hepBTiterDate.value = savedSubmission.hepB.titerDate || '';
        if (hepBTiterPositive) hepBTiterPositive.checked = !!savedSubmission.hepB.titerPositive;
      }

      if (savedSubmission.varicella){
        resetVaricellaFields();
        if (savedSubmission.varicella.option === 'military') varicellaOptionMilitary.checked = true;
        if (savedSubmission.varicella.option === 'vaccination') varicellaOptionVaccination.checked = true;
        if (savedSubmission.varicella.option === 'titer') varicellaOptionTiter.checked = true;
        updateVaricellaOption();
        if (varicellaDose1Date) varicellaDose1Date.value = savedSubmission.varicella.vaccinationDates?.[0] || '';
        if (varicellaDose2Date) varicellaDose2Date.value = savedSubmission.varicella.vaccinationDates?.[1] || '';
        if (varicellaTiterDate) varicellaTiterDate.value = savedSubmission.varicella.titerDate || '';
        if (savedSubmission.varicella.titerResult === 'positive') varicellaTiterPositive.checked = true;
        if (savedSubmission.varicella.titerResult === 'negative') varicellaTiterNegative.checked = true;
      }

      if (savedSubmission.mmr){
        resetMmrFields();
        if (savedSubmission.mmr.option === 'military') mmrOptionMilitary.checked = true;
        if (savedSubmission.mmr.option === 'vaccination') mmrOptionVaccination.checked = true;
        if (savedSubmission.mmr.option === 'titer') mmrOptionTiter.checked = true;
        updateMmrOption();
        if (mmrDose1Date) mmrDose1Date.value = savedSubmission.mmr.vaccinationDates?.[0] || '';
        if (mmrDose2Date) mmrDose2Date.value = savedSubmission.mmr.vaccinationDates?.[1] || '';
        const applyMmrRows = (type, rows) => {
          if (!Array.isArray(rows)) return;
          rows.forEach((row, index) => {
            if (index > 0) addMmrBoosterRow(type);
            const group = mmrGroupFor(type);
            const targetRow = group?.querySelectorAll('[data-mmr-row]')?.[index];
            if (!targetRow) return;
            const dateInput = targetRow.querySelector('input[type="date"]');
            if (dateInput) dateInput.value = row.date || '';
            if (row.result){
              const resRadio = targetRow.querySelector(`input[type="radio"][value="${row.result}"]`);
              if (resRadio) resRadio.checked = true;
            }
          });
          updateMmrBoosterVisibility(type);
        };
        applyMmrRows('measles', savedSubmission.mmr.titers?.measles || []);
        applyMmrRows('mumps', savedSubmission.mmr.titers?.mumps || []);
        applyMmrRows('rubella', savedSubmission.mmr.titers?.rubella || []);
      }

      if (savedSubmission.influenza){
        resetInfluenzaFields();
        const vaccinations = savedSubmission.influenza.vaccinations || [];
        vaccinations.forEach((entry, index) => {
          if (index > 0) addInfluenzaField();
          const rows = influenzaVaccinations?.querySelectorAll('[data-influenza-entry], [data-influenza-extra]');
          const row = rows?.[index];
          if (!row) return;
          const dateInput = row.querySelector('input[type="date"]');
          const locationInput = row.querySelector('input[type="text"]');
          if (dateInput) dateInput.value = entry.date || '';
          if (locationInput) locationInput.value = entry.location || '';
        });
      }

      if (savedSubmission.tuberculin){
        resetTuberculinFields();
        if (savedSubmission.tuberculin.option === 'two_step') tuberculinOptionTwoStep.checked = true;
        if (savedSubmission.tuberculin.option === 'igra') tuberculinOptionIgra.checked = true;
        if (savedSubmission.tuberculin.option === 'history') tuberculinOptionHistory.checked = true;
        updateTuberculinOption();
        if (tuberculinTest1Place) tuberculinTest1Place.value = savedSubmission.tuberculin.twoStep?.test1?.placeDate || '';
        if (tuberculinTest1Read) tuberculinTest1Read.value = savedSubmission.tuberculin.twoStep?.test1?.readDate || '';
        if (tuberculinTest1Mm) tuberculinTest1Mm.value = savedSubmission.tuberculin.twoStep?.test1?.resultMm || '';
        if (savedSubmission.tuberculin.twoStep?.test1?.result === 'neg') tuberculinTest1Neg.checked = true;
        if (savedSubmission.tuberculin.twoStep?.test1?.result === 'pos') tuberculinTest1Pos.checked = true;
        if (tuberculinTest2Place) tuberculinTest2Place.value = savedSubmission.tuberculin.twoStep?.test2?.placeDate || '';
        if (tuberculinTest2Read) tuberculinTest2Read.value = savedSubmission.tuberculin.twoStep?.test2?.readDate || '';
        if (tuberculinTest2Mm) tuberculinTest2Mm.value = savedSubmission.tuberculin.twoStep?.test2?.resultMm || '';
        if (savedSubmission.tuberculin.twoStep?.test2?.result === 'neg') tuberculinTest2Neg.checked = true;
        if (savedSubmission.tuberculin.twoStep?.test2?.result === 'pos') tuberculinTest2Pos.checked = true;
        if (tuberculinIgraDate) tuberculinIgraDate.value = savedSubmission.tuberculin.igra?.dateDrawn || '';
        if (savedSubmission.tuberculin.igra?.result === 'neg') tuberculinIgraNeg.checked = true;
        if (savedSubmission.tuberculin.igra?.result === 'pos') tuberculinIgraPos.checked = true;
        if (tuberculinChestDate) tuberculinChestDate.value = savedSubmission.tuberculin.history?.chestDate || '';
        if (savedSubmission.tuberculin.history?.result === 'neg') tuberculinChestNeg.checked = true;
        if (savedSubmission.tuberculin.history?.result === 'pos') tuberculinChestPos.checked = true;
      }

      if (savedSubmission.covid){
        resetCovidFields();
        covidNoVaccination.checked = !!savedSubmission.covid.noVaccination;
        if (covidManufacturer) covidManufacturer.value = savedSubmission.covid.manufacturer || '';
        updateCovidOption();
        const doses = savedSubmission.covid.doses || [];
        doses.forEach((dose, index) => {
          if (index > 0) addCovidBooster();
          const inputs = covidDoseList?.querySelectorAll('input[type="date"]') || [];
          const input = inputs[index];
          if (input) input.value = dose || '';
        });
      }
    }
    detailModal.show();
  }

  function resolveProgram(person){
    const program = person.program || person.programs?.[0] || person.profile?.program || '';
    const school = person.school || person.schools?.[0] || person.profile?.school || '';
    return { program, school };
  }

  function isDvsProgram(program, school){
    const key = `${normalizeSchoolName(school)}::${normalizeProgramName(program)}`;
    return dvsProgramKeys.has(key);
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
      const phone = person.phone || person.profile?.primaryPhone || `(555) 01${seed % 10}${seed % 7}-${1000 + (seed % 900)}`;
      const emergName = person.emergName || person.profile?.emergencyName || `Contact ${person.name?.split(' ')[0] || 'CPNW'}`;
      const emergPhone = person.emergPhone || person.profile?.emergencyPhone || `(555) 02${seed % 9}${seed % 8}-${1200 + (seed % 700)}`;
      const dob = person.dob || new Date(1994 + (seed % 8), seed % 12, (seed % 26) + 1);
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
      return status === 'Submitted';
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
      if (selectedReqs.size){
        const matches = CPNW_REQUIREMENTS.some((req, idx) => {
          if (!selectedReqs.has(req)) return false;
          return reqNeedsReview(p.email, req, `cpnw_${idx + 1}`);
        });
        if (!matches) return false;
      }
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
      const storedRecord = requirementsStore
        ? requirementsStore.getRecord(requirementsStore.resolveStudentKey({ email: person.email }), req)
        : null;
      const submittedAtRaw = submissions?.[submissionKey]?.submittedAt;
      const submittedAt = submittedAtRaw ? new Date(submittedAtRaw) : null;
      const decisionAt = decision?.at
        ? new Date(decision.at)
        : (storedRecord?.updatedAt ? new Date(storedRecord.updatedAt) : null);
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

  varicellaOptionMilitary?.addEventListener('change', updateVaricellaOption);
  varicellaOptionVaccination?.addEventListener('change', updateVaricellaOption);
  varicellaOptionTiter?.addEventListener('change', updateVaricellaOption);
  mmrOptionMilitary?.addEventListener('change', updateMmrOption);
  mmrOptionVaccination?.addEventListener('change', updateMmrOption);
  mmrOptionTiter?.addEventListener('change', updateMmrOption);
  [
    { type: 'measles', group: mmrMeaslesGroup },
    { type: 'mumps', group: mmrMumpsGroup },
    { type: 'rubella', group: mmrRubellaGroup }
  ].forEach(({ type, group }) => {
    group?.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', () => updateMmrBoosterVisibility(type));
    });
    group?.querySelector('[data-mmr-add]')?.addEventListener('click', () => addMmrBoosterRow(type));
  });
  influenzaAdd?.addEventListener('click', addInfluenzaField);
  tuberculinOptionTwoStep?.addEventListener('change', updateTuberculinOption);
  tuberculinOptionIgra?.addEventListener('change', updateTuberculinOption);
  tuberculinOptionHistory?.addEventListener('change', updateTuberculinOption);
  tuberculinDownload?.addEventListener('click', () => {
    const content = [
      'TB Check Form',
      '',
      'Student name:',
      'Program:',
      'School:',
      '',
      'Screening details:',
      '',
      'Provider signature:',
      'Date:'
    ].join('\\n');
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TBCheckForm.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
  covidNoVaccination?.addEventListener('change', updateCovidOption);
  covidAddBooster?.addEventListener('click', addCovidBooster);

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

    const submissionMode = isTdapRequirement(currentReqName)
      ? 'tdap'
      : (isCriminalDisclosureRequirement(currentReqName)
        ? 'criminal_disclosure'
        : (isHepBRequirement(currentReqName)
          ? 'hep_b'
          : (isVaricellaRequirement(currentReqName)
            ? 'varicella'
            : (isMmrRequirement(currentReqName)
              ? 'mmr'
              : (isInfluenzaRequirement(currentReqName)
                ? 'influenza'
                : (isTuberculinRequirement(currentReqName)
                  ? 'tuberculin'
                  : (isBlsRequirement(currentReqName)
                    ? 'bls'
                    : (isCovidRequirement(currentReqName)
                      ? 'covid'
                      : (Array.from(subRadios).find(r => r.checked)?.value || '')))))))));

    const influenzaEntries = isInfluenzaRequirement(currentReqName) && influenzaVaccinations
      ? Array.from(influenzaVaccinations.querySelectorAll('[data-influenza-entry], [data-influenza-extra]'))
        .map(row => {
          const date = row.querySelector('input[type="date"]')?.value || '';
          const location = (row.querySelector('input[type="text"]')?.value || '').trim();
          return (date || location) ? { date, location } : null;
        })
        .filter(Boolean)
      : [];

    const covidEntries = isCovidRequirement(currentReqName) && covidDoseList
      ? Array.from(covidDoseList.querySelectorAll('input[type="date"]'))
        .map(el => el.value)
        .filter(Boolean)
      : [];

    const collectMmrRows = (type) => {
      const group = mmrGroupFor(type);
      if (!group) return [];
      return Array.from(group.querySelectorAll('[data-mmr-row]'))
        .map(row => ({
          date: row.querySelector('input[type="date"]')?.value || '',
          result: row.querySelector('input[type="radio"]:checked')?.value || ''
        }))
        .filter(row => row.date || row.result);
    };

    const submissionPayload = {
      mode: submissionMode,
      completedDate: subCompletedDate?.value || '',
      seriesStart: subSeriesStart?.value || '',
      seriesDue: subSeriesDue?.value || '',
      otherNotes: subOtherNotes?.value || '',
      disclosureDates: isCriminalDisclosureRequirement(currentReqName) && criminalDisclosureDates
        ? Array.from(criminalDisclosureDates.querySelectorAll('input[type="date"]')).map(el => el.value).filter(Boolean)
        : [],
      hepB: isHepBRequirement(currentReqName) ? {
        mainOption: hepBOptionTiter?.checked ? 'titer' : (hepBOptionNoTiter?.checked ? 'notiter' : ''),
        titerDate: hepBTiterDate?.value || '',
        titerPositive: !!hepBTiterPositive?.checked,
        noTiterReason: hepBReasonNonConverter?.checked
          ? 'nonconverter'
          : (hepBReasonSeriesInProcess?.checked
            ? 'inprocess'
            : (hepBReasonHistory?.checked ? 'history' : (hepBReasonHealth?.checked ? 'health' : ''))),
        healthReason: hepBHealthReasonInput?.value || '',
        series: {
          ncSeries1Steps: hepBNcSeries1Two?.checked ? 2 : (hepBNcSeries1Three?.checked ? 3 : 0),
          ncSeries2Steps: hepBNcSeries2Two?.checked ? 2 : (hepBNcSeries2Three?.checked ? 3 : 0),
          ipSeries1Steps: hepBIpSeries1Two?.checked ? 2 : (hepBIpSeries1Three?.checked ? 3 : 0)
        }
      } : null,
      varicella: isVaricellaRequirement(currentReqName) ? {
        option: Array.from(varicellaRadios).find(r => r.checked)?.value || '',
        vaccinationDates: [varicellaDose1Date?.value || '', varicellaDose2Date?.value || ''].filter(Boolean),
        titerDate: varicellaTiterDate?.value || '',
        titerResult: varicellaTiterPositive?.checked ? 'positive' : (varicellaTiterNegative?.checked ? 'negative' : '')
      } : null,
      mmr: isMmrRequirement(currentReqName) ? {
        option: Array.from(mmrRadios).find(r => r.checked)?.value || '',
        vaccinationDates: [mmrDose1Date?.value || '', mmrDose2Date?.value || ''].filter(Boolean),
        titers: {
          measles: collectMmrRows('measles'),
          mumps: collectMmrRows('mumps'),
          rubella: collectMmrRows('rubella')
        }
      } : null,
      influenza: isInfluenzaRequirement(currentReqName) ? {
        vaccinations: influenzaEntries
      } : null,
      tuberculin: isTuberculinRequirement(currentReqName) ? {
        option: tuberculinOptionTwoStep?.checked
          ? 'two_step'
          : (tuberculinOptionIgra?.checked ? 'igra' : (tuberculinOptionHistory?.checked ? 'history' : '')),
        twoStep: {
          test1: {
            placeDate: tuberculinTest1Place?.value || '',
            readDate: tuberculinTest1Read?.value || '',
            resultMm: tuberculinTest1Mm?.value || '',
            result: tuberculinTest1Neg?.checked ? 'neg' : (tuberculinTest1Pos?.checked ? 'pos' : '')
          },
          test2: {
            placeDate: tuberculinTest2Place?.value || '',
            readDate: tuberculinTest2Read?.value || '',
            resultMm: tuberculinTest2Mm?.value || '',
            result: tuberculinTest2Neg?.checked ? 'neg' : (tuberculinTest2Pos?.checked ? 'pos' : '')
          }
        },
        igra: {
          dateDrawn: tuberculinIgraDate?.value || '',
          result: tuberculinIgraNeg?.checked ? 'neg' : (tuberculinIgraPos?.checked ? 'pos' : '')
        },
        history: {
          chestDate: tuberculinChestDate?.value || '',
          result: tuberculinChestNeg?.checked ? 'neg' : (tuberculinChestPos?.checked ? 'pos' : '')
        }
      } : null,
      covid: isCovidRequirement(currentReqName) ? {
        noVaccination: !!covidNoVaccination?.checked,
        manufacturer: (covidManufacturer?.value || '').trim(),
        doses: covidEntries
      } : null
    };

    saveDecision(currentStudentEmail, currentReqName, {
      status,
      reason,
      submission: submissionPayload,
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

  function renderReqFilters(){
    if (!reqFilterWrap) return;
    const listWrap = reqFilterWrap.querySelector('.d-grid');
    if (!listWrap) return;
    listWrap.innerHTML = CPNW_REQUIREMENTS.map((req) => `
      <label class="form-check">
        <input class="form-check-input" type="checkbox" value="${req}">
        <span class="form-check-label">${req.replace(/^CPNW:\\s*/, '')}</span>
      </label>
    `).join('');
  }

  function updateReqFilterHint(){
    if (!reqFilterHint) return;
    reqFilterHint.textContent = selectedReqs.size ? `${selectedReqs.size} selected` : 'All requirements';
  }

  reqFilterWrap?.addEventListener('change', (e) => {
    const input = e.target.closest('input[type="checkbox"]');
    if (!input) return;
    if (input.checked) selectedReqs.add(input.value);
    else selectedReqs.delete(input.value);
    updateReqFilterHint();
    reviewPage = 1;
    renderReviews();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-download-file]');
    if (!btn) return;
    alert('This is a demo. Uploaded documents would download in a real scenario.');
  });

  updateFilterOptions();
  renderReqFilters();
  updateReqFilterHint();
  renderReviews();
})();
