(function(){
  const reviewerTableBody = document.getElementById('reviewerTableBody');
  const schoolFilter = document.getElementById('reviewerSchoolFilters');
  const programFilter = document.getElementById('reviewerProgramFilters');

  const modalEl = document.getElementById('cpnwReviewModal');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
  const modalSub = document.getElementById('cpnwReviewModalSub');
  const modalSchool = document.getElementById('cpnwReviewSchool');
  const modalProgram = document.getElementById('cpnwReviewProgram');
  const modalElearning = document.getElementById('cpnwReviewElearning');
  const modalReqBody = document.getElementById('cpnwReviewReqBody');
  const needsReviewCount = document.getElementById('reviewerNeedsReviewCount');
  const watchNeededCount = document.getElementById('reviewerWatchNeededCount');
  const approvalsWeek = document.getElementById('reviewerApprovalsWeek');
  const avgReviewTime = document.getElementById('reviewerAvgReviewTime');
  const notificationsWrap = document.getElementById('reviewerNotifications');
  const programsList = document.getElementById('reviewerProgramsList');
  const programCount = document.getElementById('reviewerProgramCount');
  const programCountPanel = document.getElementById('reviewerProgramCountPanel');
  const schoolCount = document.getElementById('reviewerSchoolCount');
  const queueTotal = document.getElementById('reviewerQueueTotal');

  const DVS_PACKAGES = new Set(['sp-13', 'sp-14', 'my-17', 'my-18']);
  const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
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

  function listPeople(){
    const people = window.CPNW?.demoPeople || [];
    return people.filter(p => ['student','faculty'].includes(p.role));
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

  function getStudentData(email){
    const key = `cpnw-student-data-${String(email || '').toLowerCase()}`;
    return loadJSON(key, { submissions: {}, elearning: {} });
  }

  function getStudentMessages(email){
    const data = getStudentData(email);
    return data?.messages && typeof data.messages === 'object' ? data.messages : {};
  }

  function seedReviewerMessages(eligible){
    const targets = eligible.slice(0, 2);
    targets.forEach((person, idx) => {
      const data = getStudentData(person.email);
      data.messages = data.messages && typeof data.messages === 'object' ? data.messages : {};
      if (Object.keys(data.messages).length) return;
      const reqId = `cpnw_${idx + 7}`;
      data.messages[reqId] = [
        {
          from: 'Student',
          to: ['CPNW Reviewer'],
          body: idx === 0 ? 'Uploaded my Hep B titer result for review.' : 'Can you confirm my background check submission?',
          at: new Date().toLocaleString()
        }
      ];
      saveJSON(`cpnw-student-data-${String(person.email || '').toLowerCase()}`, data);
    });
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

  function countElearningCompleted(email){
    const data = getStudentData(email);
    const elearning = data?.elearning || {};
    return Object.values(elearning).filter((v) => v && v.passedAt).length;
  }

  function getDecisionStore(){
    return loadJSON('cpnw-reviewer-decisions-v1', {});
  }

  function setDecision(email, reqName, status){
    const store = getDecisionStore();
    const key = `${email}|${reqName}`.toLowerCase();
    store[key] = { status, at: new Date().toISOString() };
    saveJSON('cpnw-reviewer-decisions-v1', store);
    if (requirementsStore?.setStatus){
      requirementsStore.setStatus({ email }, reqName, status, {
        source: 'decision',
        updatedAt: new Date().toISOString()
      });
    }
  }

  function getDecision(email, reqName){
    const store = getDecisionStore();
    return store[`${email}|${reqName}`.toLowerCase()] || null;
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

  function statusBadge(status){
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return '<span class="badge text-bg-success">Approved</span>';
    if (s === 'conditionally approved') return '<span class="badge text-bg-primary">Conditionally Approved</span>';
    if (s === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
    if (s === 'submitted') return '<span class="badge text-bg-info text-dark">Submitted</span>';
    if (s === 'in review') return '<span class="badge text-bg-warning text-dark">In Review</span>';
    if (s === 'expired') return '<span class="badge text-bg-dark">Expired</span>';
    if (s === 'expiring' || s === 'expiring soon') return '<span class="badge text-bg-warning text-dark">Expiring</span>';
    if (s === 'declination') return '<span class="badge text-bg-danger-subtle text-danger">Declination</span>';
    return '<span class="badge text-bg-secondary">Not Submitted</span>';
  }

  function buildRows(){
    const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];
    const selectedSchools = Array.from(schoolFilter?.querySelectorAll('input[type=\"checkbox\"]:checked') || []).map(el => el.value);
    const selectedPrograms = Array.from(programFilter?.querySelectorAll('input[type=\"checkbox\"]:checked') || [])
      .map(el => normalizeProgramName(el.value));

    const filtered = roster.filter((person) => {
      const { program, school } = resolveProgram(person);
      if (!program || !school) return false;
      if (!isDvsProgram(program, school)) return false;
      if (selectedSchools.length && !selectedSchools.includes(school)) return false;
      if (selectedPrograms.length && !selectedPrograms.includes(normalizeProgramName(program))) return false;
      return true;
    });

    const rows = filtered.map((person) => {
      const { program, school } = resolveProgram(person);
      const elearningCount = countElearningCompleted(person.email);
      return {
        name: person.name,
        email: person.email,
        role: person.role,
        school,
        program,
        elearningCount
      };
    });

    rows.sort((a,b) => a.name.localeCompare(b.name));
    return rows;
  }

  function updateMetrics(){
    const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];
    const eligible = roster.filter((person) => {
      const { program, school } = resolveProgram(person);
      return program && school && isDvsProgram(program, school);
    });

    const selectedSchools = Array.from(schoolFilter?.querySelectorAll('input[type="checkbox"]:checked') || []).map(el => el.value);
    const selectedPrograms = Array.from(programFilter?.querySelectorAll('input[type="checkbox"]:checked') || [])
      .map(el => normalizeProgramName(el.value));
    const filteredEligible = eligible.filter((person) => {
      const { program, school } = resolveProgram(person);
      if (selectedSchools.length && !selectedSchools.includes(school)) return false;
      if (selectedPrograms.length && !selectedPrograms.includes(normalizeProgramName(program))) return false;
      return true;
    });

    seedReviewerMessages(filteredEligible);

    let needsReview = 0;
    let watchNeeded = 0;
    const watchIdx = CPNW_REQUIREMENTS.findIndex(r => r.toLowerCase().includes('watch'));
    const programMap = new Map();

    filteredEligible.forEach((person) => {
      let hasNeedsReview = false;
      CPNW_REQUIREMENTS.forEach((req, idx) => {
        const submissionKey = `cpnw_${idx + 1}`;
        const status = requirementStatus(person.email, req, submissionKey);
        if (status === 'Submitted') hasNeedsReview = true;
      });
      if (hasNeedsReview) needsReview += 1;

      if (watchIdx >= 0){
        const watchStatus = requirementStatus(person.email, CPNW_REQUIREMENTS[watchIdx], `cpnw_${watchIdx + 1}`);
        if (watchStatus === 'Not Submitted') watchNeeded += 1;
      }

      const { program, school } = resolveProgram(person);
      const key = `${school}::${program}`;
      const entry = programMap.get(key) || { school, program, students: 0, needsReview: 0, watchNeeded: 0, elearningComplete: 0 };
      entry.students += 1;
      if (hasNeedsReview) entry.needsReview += 1;
      if (watchIdx >= 0){
        const watchStatus = requirementStatus(person.email, CPNW_REQUIREMENTS[watchIdx], `cpnw_${watchIdx + 1}`);
        if (watchStatus === 'Not Submitted') entry.watchNeeded += 1;
      }
      if (countElearningCompleted(person.email) >= 10) entry.elearningComplete += 1;
      programMap.set(key, entry);
    });

    if (needsReviewCount) needsReviewCount.textContent = String(needsReview);
    if (watchNeededCount) watchNeededCount.textContent = String(watchNeeded);

    const store = getDecisionStore();
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const recent = Object.values(store).filter((item) => {
      const at = item?.at ? new Date(item.at).getTime() : 0;
      return at && now - at <= weekMs;
    });
    if (approvalsWeek) approvalsWeek.textContent = String(recent.filter(r => String(r.status || '').toLowerCase() === 'approved').length);
    if (avgReviewTime){
      avgReviewTime.textContent = recent.length ? '1.8 days' : '—';
    }

    if (programsList){
      const entries = Array.from(programMap.values()).sort((a,b) => a.program.localeCompare(b.program));
      programsList.innerHTML = entries.map((p) => `
        <li class="d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">${p.program}</div>
            <p class="small text-body-secondary mb-0">${p.school}</p>
          </div>
          <span class="badge text-bg-secondary">${p.students}</span>
        </li>
      `).join('') || '<li class="text-body-secondary small">No DVS programs available.</li>';
    }
    const programTotal = programMap.size || 0;
    if (programCount) programCount.textContent = programTotal ? String(programTotal) : 'All';
    if (programCountPanel) programCountPanel.textContent = programTotal ? String(programTotal) : '--';
    if (schoolCount){
      const schoolTotal = new Set(Array.from(programMap.values()).map(p => p.school)).size;
      schoolCount.textContent = schoolTotal ? String(schoolTotal) : 'All';
    }

    if (notificationsWrap){
      const messageItems = [];
      filteredEligible.forEach((person) => {
        const messagesByReq = getStudentMessages(person.email);
        Object.entries(messagesByReq).forEach(([reqId, msgs]) => {
          const list = Array.isArray(msgs) ? msgs : [];
          list.forEach((msg) => {
            const to = Array.isArray(msg?.to) ? msg.to : [];
            if (msg?.from !== 'Student') return;
            if (!to.includes('CPNW Reviewer')) return;
            const reqIndex = Number(String(reqId).replace('cpnw_', '')) - 1;
            const reqLabel = Number.isFinite(reqIndex) && CPNW_REQUIREMENTS[reqIndex] ? CPNW_REQUIREMENTS[reqIndex] : 'CPNW Requirement';
            messageItems.push({
              student: person.name,
              email: person.email,
              reqLabel,
              body: String(msg.body || ''),
              at: msg.at || '',
              timestamp: Date.parse(msg.at || '') || 0
            });
          });
        });
      });

      messageItems.sort((a,b) => b.timestamp - a.timestamp);
      const trimmed = messageItems.slice(0, 5);
      notificationsWrap.innerHTML = trimmed.map((item) => `
        <li class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-semibold">${item.student}</div>
            <p class="small text-body-secondary mb-1">${item.reqLabel}</p>
            <p class="small mb-0">${item.body || 'New message from student.'}</p>
          </div>
          <span class="badge text-bg-warning text-dark">Message</span>
        </li>
      `).join('');

      if (!trimmed.length){
        notificationsWrap.innerHTML = '<li class="text-body-secondary small">No new reviewer messages.</li>';
      }
    }

  }

  function renderTable(){
    updateMetrics();
  }

  function renderModal(person){
    if (!modal || !modalReqBody) return;
    const { program, school } = resolveProgram(person);
    const elearningCount = countElearningCompleted(person.email);

    if (modalSub) modalSub.textContent = `${person.name} • ${person.email}`;
    if (modalSchool) modalSchool.textContent = school || '—';
    if (modalProgram) modalProgram.textContent = program || '—';
    if (modalElearning) modalElearning.textContent = `${elearningCount}/10 completed`;

    const submissions = getStudentData(person.email)?.submissions || {};

    modalReqBody.innerHTML = CPNW_REQUIREMENTS.map((req, idx) => {
      const submissionKey = `cpnw_${idx + 1}`;
      const submitted = submissions && submissions[submissionKey];
      const decision = getDecision(person.email, req);
      const status = decision?.status
        ? decision.status
        : (submitted ? 'Submitted' : 'Not Submitted');
      return `
        <tr>
          <td>${req}</td>
          <td>${statusBadge(status)}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-success" type="button" data-decision="Approved" data-email="${person.email}" data-req="${req}">Approve</button>
              <button class="btn btn-outline-primary" type="button" data-decision="Conditionally Approved" data-email="${person.email}" data-req="${req}">Conditional</button>
              <button class="btn btn-outline-danger" type="button" data-decision="Rejected" data-email="${person.email}" data-req="${req}">Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    modal.show();
  }

  function populateFilters(){
    if (schoolFilter){
      const schools = [...new Set(dvsPrograms.map(p => p.school))];
      schoolFilter.innerHTML = schools.map((school) => `
        <label class="btn btn-outline-secondary btn-sm btn-cpnw d-flex align-items-center gap-2">
          <input class="form-check-input" type="checkbox" value="${school}" checked />
          <span>${school}</span>
        </label>
      `).join('') || '<div class="text-body-secondary small">No schools found.</div>';
    }
    if (programFilter){
      const programs = [...new Set(dvsPrograms.map(p => p.program))];
      programFilter.innerHTML = programs.map((program) => `
        <label class="btn btn-outline-secondary btn-sm btn-cpnw d-flex align-items-center gap-2">
          <input class="form-check-input" type="checkbox" value="${program}" checked />
          <span>${program}</span>
        </label>
      `).join('') || '<div class="text-body-secondary small">No programs found.</div>';
    }
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-review-person]');
    if (btn){
      const email = btn.dataset.reviewPerson;
      const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];
      const person = roster.find(p => p.email === email);
      if (person) renderModal(person);
      updateMetrics();
      return;
    }

    const decisionBtn = event.target.closest('[data-decision]');
    if (decisionBtn){
      const status = decisionBtn.dataset.decision;
      const email = decisionBtn.dataset.email;
      const req = decisionBtn.dataset.req;
      setDecision(email, req, status);
      const roster = (window.CPNW && Array.isArray(window.CPNW.reviewerRoster)) ? window.CPNW.reviewerRoster : [];
      const person = roster.find(p => p.email === email);
      if (person) renderModal(person);
      updateMetrics();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.closest('#reviewerSchoolFilters') || event.target.closest('#reviewerProgramFilters')){
      renderTable();
    }
  });

  populateFilters();
  renderTable();
})();
