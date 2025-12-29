// Year + theme toggle using Bootstrap 5.3 theme attribute
(function(){
  const yearEl = document.getElementById('y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const root = document.documentElement;
  const STORAGE_KEY = 'cpnw-theme';
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

  function getToggles(){
    return Array.from(document.querySelectorAll('[data-theme-toggle]'));
  }

  function applyTheme(theme){
    root.setAttribute('data-bs-theme', theme);
    getToggles().forEach(btn => {
      const icon = btn.querySelector('[data-theme-icon]');
      const label = btn.querySelector('[data-theme-label]');
      if (icon && label){
        const isLight = theme === 'light';
        icon.textContent = isLight ? '☀️' : '🌙';
        label.textContent = isLight ? 'Light' : 'Dark';
      }
    });
  }

  let saved = null;
  try{ saved = localStorage.getItem(STORAGE_KEY); }catch(e){}
  const initial = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(initial);

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-theme-toggle]');
    if (!btn) return;
    const current = root.getAttribute('data-bs-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try{ localStorage.setItem(STORAGE_KEY, next); }catch(e){}
  });
})();

// Current user helper (shared across pages)
(function(){
  window.CPNW = window.CPNW || {};
  try{
    const raw = localStorage.getItem('cpnw-current-user');
    if (raw){
      window.CPNW.currentUser = JSON.parse(raw);
    }
  }catch(err){}
  window.CPNW.getCurrentUser = () => window.CPNW.currentUser || null;
})();

// Logout handler
(function(){
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-logout-trigger]');
    if (!trigger) return;
    event.preventDefault();
    try{
      localStorage.removeItem('cpnw-current-user');
    }catch(err){}
    if (window.CPNW) window.CPNW.currentUser = null;
    const target = trigger.getAttribute('href') || '../index.html';
    window.location.href = target;
  });
})();

// Route guard: limit access based on role + permissions.
(function(){
  const currentUser = window.CPNW && typeof window.CPNW.getCurrentUser === 'function'
    ? window.CPNW.getCurrentUser()
    : null;
  const path = window.location.pathname || '';
  const file = path.split('/').pop() || '';
  const isViews = path.includes('/views/');
  const isStudentViews = path.includes('/views/student-views/');
  const isHealthcareViews = path.includes('/views/healthcare-views/');
  const base = (isStudentViews || isHealthcareViews) ? '../../' : isViews ? '../' : '';

  const isGetStartedViews = path.includes('/views/get-started-views/');

  if (!currentUser){
    if (isViews && !isGetStartedViews){
      window.location.href = `${base}index.html`;
    }
    return;
  }

  const educationPages = new Set([
    'dashboard-education.html',
    'requirements-education.html',
    'review-education.html',
    'assignments-education.html',
    'reports-education.html',
    'users.html',
    'background-watch-reports.html',
    'requirement-builder.html'
  ]);
  const reviewerPages = new Set([
    'dashboard-cpnw-reviewer.html',
    'reviewer-attention.html',
    'cpnw-watch-reports.html',
    'reports-cpnw.html',
    'users-cpnw.html',
    'reviewer-attention.html'
  ]);
  const educationNoAccess = 'education-no-access.html';
  const healthcarePages = new Set(['dashboard-healthcare.html']);
  const profilePages = new Set(['my-profile.html', 'security-settings.html']);

  const role = String(currentUser.role || '').toLowerCase();
  const canCoordinate = !!currentUser.permissions?.canCoordinate;

  function landingForRole(){
    if (role === 'education'){
      return canCoordinate ? `${base}views/dashboard-education.html` : `${base}views/education-no-access.html`;
    }
    if (role === 'faculty'){
      return canCoordinate ? `${base}views/dashboard-faculty-admin.html` : `${base}views/student-views/dashboard-student.html`;
    }
    if (role === 'student'){
      return `${base}views/student-views/dashboard-student.html`;
    }
    if (role === 'healthcare'){
      return `${base}views/healthcare-views/dashboard-healthcare.html`;
    }
    if (role === 'cpnw-reviewer'){
      return `${base}views/dashboard-cpnw-reviewer.html`;
    }
    return `${base}index.html`;
  }

  function redirectTo(target){
    if (!target || window.location.href.endsWith(target)) return;
    window.location.href = target;
  }

  if (file === 'dashboard-faculty-admin.html'){
    if (role === 'faculty' && canCoordinate){
      redirectTo(`${base}views/dashboard-education.html`);
    }else{
      redirectTo(landingForRole());
    }
    return;
  }

  if (educationPages.has(file)){
    if (role === 'education'){
      if (!canCoordinate) redirectTo(`${base}views/education-no-access.html`);
    }else if (role === 'faculty' && canCoordinate){
      // Faculty admins can access education tools.
    }else{
      redirectTo(landingForRole());
    }
    return;
  }

  if (reviewerPages.has(file)){
    if (role !== 'cpnw-reviewer'){
      redirectTo(landingForRole());
    }
    return;
  }

  if (file === educationNoAccess){
    if (!(role === 'education' && !canCoordinate)){
      redirectTo(landingForRole());
    }
    return;
  }

  if (isHealthcareViews || healthcarePages.has(file)){
    if (role !== 'healthcare'){
      redirectTo(landingForRole());
    }
    return;
  }

  if (isViews && profilePages.has(file)){
    if (role === 'student' || (role === 'faculty' && !canCoordinate)){
      const target = file === 'my-profile.html'
        ? `${base}views/student-views/my-profile.html`
        : `${base}views/student-views/security-settings.html`;
      redirectTo(target);
    }
  }
})();

// Populate current user name in headers if present.
(function(){
  const currentUser = window.CPNW && typeof window.CPNW.getCurrentUser === 'function'
    ? window.CPNW.getCurrentUser()
    : null;
  if (!currentUser || !currentUser.name) return;
  document.querySelectorAll('[data-current-user-name]').forEach((el) => {
    el.textContent = currentUser.name;
  });
})();

// Faculty admin/student view toggle (shown only for faculty with CanCoordinate).
(function(){
  const currentUser = window.CPNW && typeof window.CPNW.getCurrentUser === 'function'
    ? window.CPNW.getCurrentUser()
    : null;
  if (!currentUser || currentUser.role !== 'faculty' || !currentUser.permissions?.canCoordinate) return;

  const toggle = document.querySelector('[data-faculty-view-toggle]');
  if (!toggle) return;
  toggle.classList.remove('d-none');

  const adminBtn = toggle.querySelector('[data-faculty-view-btn="admin"]');
  const facultyBtn = toggle.querySelector('[data-faculty-view-btn="faculty"]');
  const path = window.location.pathname || '';
  const isAdmin = path.includes('dashboard-education.html');
  if (adminBtn) adminBtn.classList.toggle('active', isAdmin);
  if (facultyBtn) facultyBtn.classList.toggle('active', !isAdmin);
})();

// Cohort storage helpers (custom cohorts + membership counts)
(function(){
  const COHORTS_KEY = 'cpnw-custom-cohorts-v1';
  const MEMBERS_KEY = 'cpnw-cohort-members-v1';
  const USER_COHORT_KEY = 'cpnw-user-cohort-v1';

  function loadJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  }

  function saveJSON(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){}
  }

  function toProgramId(programName){
    const n = String(programName || '').toLowerCase();
    if (n.includes('bsn')) return 'bsn';
    if (n.includes('adn')) return 'adn';
    if (n.includes('surg')) return 'surg';
    return 'custom';
  }

  function uid(){
    // Not cryptographic; good enough for demo IDs.
    return `coh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeName(value){
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function getAyContext(){
    const today = new Date();
    const FALL_START_MONTH = 7; // August (0-based)
    const thisYear = today.getFullYear();
    const currentAyStart = today.getMonth() >= FALL_START_MONTH ? thisYear : thisYear - 1;
    return {
      currentAyStart,
      ayMin: currentAyStart - 3,
      ayMax: currentAyStart + 1
    };
  }

  function listCustomCohortsRaw(){
    const raw = loadJSON(COHORTS_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(c => c && typeof c === 'object')
      .map(c => ({
        id: String(c.id || ''),
        name: String(c.name || '').slice(0, 75),
        program: String(c.program || ''),
        ayStart: Number.isFinite(Number(c.ayStart)) ? Number(c.ayStart) : null,
        createdAt: String(c.createdAt || '')
      }))
      .filter(c => c.id && c.name && c.program && Number.isFinite(c.ayStart));
  }

  function getMembershipCounts(){
    const raw = loadJSON(MEMBERS_KEY, {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    Object.entries(raw).forEach(([k, v]) => {
      const num = Number(v);
      out[k] = Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
    });
    return out;
  }

  function bumpMembership(cohortKey, delta){
    if (!cohortKey) return;
    const counts = getMembershipCounts();
    const cur = counts[cohortKey] || 0;
    const next = Math.max(0, cur + delta);
    counts[cohortKey] = next;
    saveJSON(MEMBERS_KEY, counts);
  }

  function seedKeyForLabel(label){
    return `seed:${String(label || '').trim()}`;
  }

  function addCustomCohort({ name, program, ayStart }){
    const trimmedName = String(name || '').trim().slice(0, 75);
    const trimmedProgram = String(program || '').trim();
    const start = Number.isFinite(Number(ayStart)) ? Number(ayStart) : null;
    if (!trimmedName || !trimmedProgram || !Number.isFinite(start)) return null;

    // Enforce uniqueness (case-insensitive) within the same program.
    const collision = listCustomCohortsRaw().find(c => {
      return normalizeName(c.program) === normalizeName(trimmedProgram) &&
        normalizeName(c.name) === normalizeName(trimmedName);
    });
    if (collision) return null;

    const record = {
      id: uid(),
      name: trimmedName,
      program: trimmedProgram,
      ayStart: start,
      createdAt: new Date().toISOString()
    };
    const existing = listCustomCohortsRaw();
    existing.push(record);
    saveJSON(COHORTS_KEY, existing);
    return record;
  }

  function listCustomCohortsLegacy({ ayMin, ayMax } = {}){
    const { currentAyStart } = getAyContext();
    const min = Number.isFinite(Number(ayMin)) ? Number(ayMin) : (currentAyStart - 3);
    const max = Number.isFinite(Number(ayMax)) ? Number(ayMax) : (currentAyStart + 1);
    const counts = getMembershipCounts();
    return listCustomCohortsRaw()
      .filter(c => c.ayStart >= min && c.ayStart <= max)
      .map(c => {
        const cohortLabel = `${c.program} – ${c.name}`;
        return {
          cohortId: c.id,
          cohortLabel,
          program: c.program,
          ayStart: c.ayStart,
          students: counts[c.id] || 0,
          custom: true,
          start: 'Custom'
        };
      });
  }

  function listCustomCohortsDashboard({ ayMin, ayMax } = {}){
    const { currentAyStart } = getAyContext();
    const min = Number.isFinite(Number(ayMin)) ? Number(ayMin) : (currentAyStart - 3);
    const max = Number.isFinite(Number(ayMax)) ? Number(ayMax) : (currentAyStart + 1);
    const counts = getMembershipCounts();
    return listCustomCohortsRaw()
      .filter(c => c.ayStart >= min && c.ayStart <= max)
      .map(c => {
        const students = counts[c.id] || 0;
        const ayStart = c.ayStart;
        const ayEnd = ayStart + 1;
        const approved = Math.min(students, Math.floor(students * 0.65));
        const pending = Math.max(0, students - approved);
        const expiring = Math.min(pending, Math.max(0, Math.floor(students * 0.2)));
        return {
          programId: toProgramId(c.program),
          programName: c.program,
          term: 'Custom',
          startYear: ayStart,
          ayStart,
          ayEnd,
          ayLabel: `${ayStart}–${ayEnd}`,
          label: `${c.program} – ${c.name}`,
          archived: false,
          visibleByDefault: true,
          students,
          approvedAssignments: approved,
          requirementsReview: pending,
          expiringStudents: expiring,
          custom: true,
          cohortId: c.id
        };
      });
  }

  window.CPNW = window.CPNW || {};
  window.CPNW.cohorts = {
    getAyContext,
    seedKeyForLabel,
    getMembershipCounts,
    bumpMembership,
    addCustomCohort,
    listCustomCohortsRaw,
    listCustomCohortsLegacy,
    listCustomCohortsDashboard,
    findCustomCohortCollision(program, name){
      const p = normalizeName(program);
      const n = normalizeName(name);
      if (!p || !n) return null;
      return listCustomCohortsRaw().find(c => normalizeName(c.program) === p && normalizeName(c.name) === n) || null;
    },
    getUserCohort(email){
      const map = loadJSON(USER_COHORT_KEY, {});
      if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
      const key = String(email || '').trim().toLowerCase();
      if (!key) return null;
      const entry = map[key];
      if (!entry || typeof entry !== 'object') return null;
      const type = String(entry.type || '');
      if (type === 'unassigned') return { type: 'unassigned' };
      if (type === 'seed' && entry.label) return { type: 'seed', label: String(entry.label) };
      if (type === 'custom' && entry.cohortId) return { type: 'custom', cohortId: String(entry.cohortId) };
      return null;
    },
    setUserCohort(email, entry){
      const key = String(email || '').trim().toLowerCase();
      if (!key) return;
      const map = loadJSON(USER_COHORT_KEY, {});
      const next = (!map || typeof map !== 'object' || Array.isArray(map)) ? {} : map;
      if (!entry){
        delete next[key];
        saveJSON(USER_COHORT_KEY, next);
        return;
      }
      const type = String(entry.type || '');
      if (type === 'unassigned'){
        next[key] = { type: 'unassigned' };
      }else if (type === 'seed' && entry.label){
        next[key] = { type: 'seed', label: String(entry.label) };
      }else if (type === 'custom' && entry.cohortId){
        next[key] = { type: 'custom', cohortId: String(entry.cohortId) };
      }else{
        return;
      }
      saveJSON(USER_COHORT_KEY, next);
    },
    getUserCohortLabel(email){
      const entry = this.getUserCohort(email);
      if (!entry) return null;
      if (entry.type === 'unassigned') return '';
      if (entry.type === 'seed') return entry.label;
      if (entry.type === 'custom'){
        const cohort = listCustomCohortsRaw().find(c => c.id === entry.cohortId);
        if (!cohort) return null;
        return `${cohort.program} – ${cohort.name}`;
      }
      return null;
    },
    getUnassignedCount(){
      const map = loadJSON(USER_COHORT_KEY, {});
      if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;
      let count = 0;
      Object.values(map).forEach((entry) => {
        if (entry && typeof entry === 'object' && String(entry.type || '') === 'unassigned'){
          count += 1;
        }
      });
      return count;
    }
  };
})();

// Ad rotator (3 slides, 15s each)
(function(){
  const slides = Array.from(document.querySelectorAll('.cpnw-ad-slide'));
  if (!slides.length) return;

  let index = 0;
  const total = slides.length;
  const DURATION = 15000;

  function show(idx){
    slides.forEach((slide, i) => {
      slide.classList.toggle('cpnw-ad-slide-active', i === idx);
    });
  }

  show(index);
  setInterval(() => {
    index = (index + 1) % total;
    show(index);
  }, DURATION);
})();

// Contact modal (mock captcha + basic client-side spam checks)
(function(){
  const fallbackHTML = `
    <div
      class="modal fade"
      id="contactModal"
      tabindex="-1"
      aria-labelledby="contactModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="contactModalLabel">Contact Us</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div
              class="alert alert-dismissible fade show d-none"
              role="alert"
              data-contact-status
            >
              <span data-contact-status-text></span>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="alert"
                aria-label="Close"
              ></button>
            </div>

            <form id="contactForm" novalidate>
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label class="form-label" for="contactName">Name</label>
                  <input
                    type="text"
                    class="form-control"
                    id="contactName"
                    name="name"
                    autocomplete="name"
                    required
                  />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label" for="contactEmail">Email address</label>
                  <input
                    type="email"
                    class="form-control"
                    id="contactEmail"
                    name="email"
                    autocomplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div class="col-12">
                  <label class="form-label" for="contactOrg">Organization</label>
                  <input
                    type="text"
                    class="form-control"
                    id="contactOrg"
                    name="organization"
                    autocomplete="organization"
                    required
                  />
                </div>
                <div class="col-12">
                  <label class="form-label" for="contactMessage">Message</label>
                  <textarea
                    class="form-control"
                    id="contactMessage"
                    name="message"
                    rows="5"
                    required
                  ></textarea>
                </div>

                <div class="visually-hidden" aria-hidden="true">
                  <label class="form-label" for="contactWebsite">Website</label>
                  <input
                    type="text"
                    class="form-control"
                    id="contactWebsite"
                    name="website"
                    autocomplete="off"
                    tabindex="-1"
                  />
                </div>

                <div class="col-12">
                  <div class="cpnw-shell p-3">
                    <div class="fw-semibold mb-2">Spam check</div>
                    <div class="form-check">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        value="1"
                        id="contactCaptchaCheck"
                      />
                      <label class="form-check-label" for="contactCaptchaCheck">
                        I’m not a robot (mock captcha)
                      </label>
                    </div>
                    <div class="mt-3 d-none" data-contact-captcha>
                      <label class="form-label" for="contactCaptchaAnswer">
                        Please answer: <span class="fw-semibold" data-contact-captcha-question></span>
                      </label>
                      <input
                        type="text"
                        inputmode="numeric"
                        class="form-control"
                        id="contactCaptchaAnswer"
                        name="captcha"
                        placeholder="Enter the answer"
                      />
                      <div class="form-text">
                        Mock spam check placeholder. Replace with a real captcha service for production.
                      </div>
                    </div>
                  </div>
                </div>

                <div class="col-12 d-flex flex-wrap gap-2 justify-content-end">
                  <button type="button" class="btn btn-cpnw btn-cpnw-primary btn-sm" data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="btn btn-cpnw btn-cpnw-primary"
                    id="contactSubmit"
                    disabled
                  >
                    Send message
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  function ensureModal(){
    let modalEl = document.getElementById('contactModal');
    if (modalEl) return modalEl;
    const wrap = document.createElement('div');
    wrap.innerHTML = fallbackHTML;
    modalEl = wrap.querySelector('#contactModal');
    if (!modalEl) return null;
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function attachHandlers(modalEl){
    if (!modalEl || modalEl.dataset.contactInit === 'true') return;
    modalEl.dataset.contactInit = 'true';

    const form = modalEl.querySelector('#contactForm');
    const submitBtn = modalEl.querySelector('#contactSubmit');
    const statusBox = modalEl.querySelector('[data-contact-status]');
    const statusText = modalEl.querySelector('[data-contact-status-text]');

    const nameInput = modalEl.querySelector('#contactName');
    const emailInput = modalEl.querySelector('#contactEmail');
    const orgInput = modalEl.querySelector('#contactOrg');
    const messageInput = modalEl.querySelector('#contactMessage');
    const honeypotInput = modalEl.querySelector('#contactWebsite');

    const captchaCheck = modalEl.querySelector('#contactCaptchaCheck');
    const captchaWrap = modalEl.querySelector('[data-contact-captcha]');
    const captchaQuestion = modalEl.querySelector('[data-contact-captcha-question]');
    const captchaAnswer = modalEl.querySelector('#contactCaptchaAnswer');

    if (
      !form ||
      !submitBtn ||
      !statusBox ||
      !statusText ||
      !nameInput ||
      !emailInput ||
      !orgInput ||
      !messageInput ||
      !honeypotInput ||
      !captchaCheck ||
      !captchaWrap ||
      !captchaQuestion ||
      !captchaAnswer
    ){
      return;
    }

    let captchaExpected = null;

    function setStatus(type, message){
      statusBox.classList.remove('d-none', 'alert-success', 'alert-danger');
      statusBox.classList.add(`alert-${type}`);
      statusText.textContent = message;
    }

    function clearStatus(){
      statusBox.classList.add('d-none');
      statusText.textContent = '';
      statusBox.classList.remove('alert-success', 'alert-danger');
    }

    function newCaptcha(){
      const a = 2 + Math.floor(Math.random() * 8);
      const b = 2 + Math.floor(Math.random() * 8);
      captchaExpected = String(a + b);
      captchaQuestion.textContent = `${a} + ${b} = ?`;
      captchaAnswer.value = '';
    }

    function setCaptchaVisible(visible){
      captchaWrap.classList.toggle('d-none', !visible);
      if (visible){
        newCaptcha();
        captchaAnswer.focus();
      }else{
        captchaExpected = null;
        captchaAnswer.value = '';
      }
    }

    function isCaptchaValid(){
      if (!captchaCheck.checked) return false;
      if (!captchaExpected) return false;
      return captchaAnswer.value.trim() === captchaExpected;
    }

    function updateSubmitState(){
      const hasHoneypot = honeypotInput.value.trim().length > 0;
      const baseValid = form.checkValidity();
      const captchaOk = isCaptchaValid();
      submitBtn.disabled = hasHoneypot || !baseValid || !captchaOk;
    }

    modalEl.addEventListener('shown.bs.modal', () => {
      clearStatus();
      form.reset();
      form.classList.remove('was-validated');
      setCaptchaVisible(false);
      submitBtn.disabled = true;
      nameInput.focus();
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      clearStatus();
      form.reset();
      form.classList.remove('was-validated');
      setCaptchaVisible(false);
      submitBtn.disabled = true;
    });

    captchaCheck.addEventListener('change', () => {
      setCaptchaVisible(captchaCheck.checked);
      updateSubmitState();
    });

    [nameInput, emailInput, orgInput, messageInput, honeypotInput, captchaAnswer].forEach((el) => {
      el.addEventListener('input', updateSubmitState);
      el.addEventListener('blur', updateSubmitState);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearStatus();

      if (!form.checkValidity()){
        form.classList.add('was-validated');
        setStatus('danger', 'Please complete all required fields.');
        updateSubmitState();
        return;
      }

      if (honeypotInput.value.trim()){
        setStatus('danger', 'Unable to submit this request.');
        return;
      }

      if (!isCaptchaValid()){
        setStatus('danger', 'Please complete the spam check.');
        updateSubmitState();
        return;
      }

      submitBtn.disabled = true;
      setStatus('success', 'Message sent (demo). This form is not wired to email yet.');
      setTimeout(() => {
        const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        instance.hide();
      }, 900);
    });
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-contact-trigger]');
    if (!trigger) return;
    event.preventDefault();
    const modalEl = ensureModal();
    if (!modalEl) return;
    attachHandlers(modalEl);
    const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    instance.show();
  });
})();

const cpnwAccessCatalog = (() => {
  const roles = {
    '87': { key: 'healthcare', label: 'Healthcare' },
    '58': { key: 'education', label: 'Education Coordinator' },
    '27': { key: 'faculty', label: 'Faculty' },
    '36': { key: 'student', label: 'Student' },
    '91': { key: 'cpnw-reviewer', label: 'CPNW Reviewer' }
  };

  const schools = [
    {
      code: '100',
      name: 'CPNW University',
      programs: [
        { code: '10011', abbr: 'ADN', name: 'Associate Degree in Nursing' },
        { code: '10012', abbr: 'BSN', name: 'Bachelor of Science in Nursing' },
        { code: '10013', abbr: 'SurgTech', name: 'Surgical Technology' }
      ]
    },
    {
      code: '101',
      name: 'CPNW Education',
      programs: [
        { code: '10111', abbr: 'ADN', name: 'Associate Degree in Nursing' },
        { code: '10112', abbr: 'BSN', name: 'Bachelor of Science in Nursing' },
        { code: '10113', abbr: 'RadTech', name: 'Radiologic Technology' }
      ]
    }
  ];

  const programLookup = new Map();
  const programs = [];

  schools.forEach((school) => {
    school.programs.forEach((program) => {
      const entry = { ...program, schoolCode: school.code, schoolName: school.name };
      programLookup.set(program.code, entry);
      programs.push(entry);
    });
  });

  programLookup.set('94', {
    code: '94',
    abbr: 'CPNW',
    name: 'CPNW Reviewer',
    schoolCode: 'CPNW',
    schoolName: 'CPNW'
  });

  return { roles, schools, programs, programLookup };
})();

const cpnwDemoPeople = [
  {
    email: 'reviewer.cpnw@cpnw.org',
    name: 'Riley Reviewer',
    role: 'cpnw-reviewer',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW University', 'CPNW Education'],
    programs: ['ADN', 'BSN', 'SurgTech', 'RadTech'],
    profile: {
      firstName: 'Riley',
      lastName: 'Reviewer',
      emailUsername: 'reviewer.cpnw@cpnw.org',
      altEmail: 'riley.reviewer@cpnw.org',
      primaryPhone: '(206) 555-0199',
      school: 'CPNW',
      program: 'CPNW Reviewer',
      emergencyName: 'Jordan Reviewer',
      emergencyPhone: '(206) 555-0182',
      address: '1200 5th Ave',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    }
  },
  {
    email: 'alex.educator@cpnw.org',
    name: 'Alex Educator',
    role: 'education',
    permissions: { canCoordinate: true, canDelete: true },
    schools: ['CPNW University', 'CPNW Education'],
    programs: ['ADN', 'BSN', 'SurgTech', 'RadTech'],
    profile: {
      firstName: 'Alex',
      lastName: 'Educator',
      emailUsername: 'alex.educator@cpnw.org',
      altEmail: 'alex@cpnw.org',
      primaryPhone: '(206) 555-0134',
      school: 'CPNW University',
      program: 'BSN',
      emergencyName: 'Jordan Educator',
      emergencyPhone: '(206) 555-0199',
      address: '1201 3rd Ave',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    }
  },
  {
    email: 'jamie.coordinator@cpnw.org',
    name: 'Jamie Coordinator',
    role: 'education',
    permissions: { canCoordinate: true, canDelete: false },
    schools: ['CPNW University'],
    programs: ['ADN', 'BSN', 'SurgTech'],
    profile: {
      firstName: 'Jamie',
      lastName: 'Coordinator',
      emailUsername: 'jamie.coordinator@cpnw.org',
      altEmail: 'jamie@cpnw.org',
      primaryPhone: '(206) 555-0177',
      school: 'CPNW University',
      program: 'ADN',
      emergencyName: 'Taylor Coordinator',
      emergencyPhone: '(206) 555-0188',
      address: '501 Pine St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    }
  },
  {
    email: 'taylor.healthcare@cpnw.org',
    name: 'Taylor Healthcare',
    role: 'healthcare',
    permissions: { canCoordinate: true, canDelete: false },
    schools: ['CPNW Healthcare Facility'],
    programs: ['CPNW Healthcare Facility'],
    profile: {
      firstName: 'Taylor',
      lastName: 'Healthcare',
      emailUsername: 'taylor.healthcare@cpnw.org',
      altEmail: 'taylor@cpnw.org',
      primaryPhone: '(206) 555-0166',
      school: 'CPNW Healthcare Facility',
      program: 'CPNW Healthcare Facility',
      emergencyName: 'Jordan Healthcare',
      emergencyPhone: '(206) 555-0168',
      address: '901 4th Ave',
      city: 'Seattle',
      state: 'WA',
      zip: '98104'
    }
  },
  {
    email: 'morgan.coordinator@cpnw.org',
    name: 'Morgan Coordinator',
    role: 'education',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['ADN', 'BSN', 'RadTech'],
    profile: {
      firstName: 'Morgan',
      lastName: 'Coordinator',
      emailUsername: 'morgan.coordinator@cpnw.org',
      altEmail: 'morgan@cpnw.org',
      primaryPhone: '(253) 555-0141',
      school: 'CPNW Education',
      program: 'BSN',
      emergencyName: 'Casey Coordinator',
      emergencyPhone: '(253) 555-0194',
      address: '900 Broadway',
      city: 'Tacoma',
      state: 'WA',
      zip: '98402'
    }
  },
  {
    email: 'student.adn.uni@cpnw.org',
    name: 'Taylor Student',
    role: 'student',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW University'],
    programs: ['ADN'],
    cohort: 'ADN – Fall 2025',
    reqs: { cpnw: 'complete', ed: 'incomplete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [
      { file: 'Immunization.pdf', req: 'Immunization', date: '2025-02-10' },
      { file: 'BLS.pdf', req: 'BLS', date: '2025-02-08' }
    ],
    profile: {
      firstName: 'Taylor',
      lastName: 'Student',
      emailUsername: 'student.adn.uni@cpnw.org',
      altEmail: 'taylor.student@cpnw.org',
      primaryPhone: '(360) 555-0130',
      school: 'CPNW University',
      program: 'ADN',
      emergencyName: 'Jordan Student',
      emergencyPhone: '(360) 555-0190',
      address: '210 Pike St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    }
  },
  {
    email: 'student.bsn.uni@cpnw.org',
    name: 'Jordan Student',
    role: 'student',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW University'],
    programs: ['BSN'],
    cohort: 'BSN – Spring 2026',
    reqs: { cpnw: 'expiring', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'BLS.pdf', req: 'BLS', date: '2025-01-22' }],
    profile: {
      firstName: 'Jordan',
      lastName: 'Student',
      emailUsername: 'student.bsn.uni@cpnw.org',
      altEmail: 'jordan.student@cpnw.org',
      primaryPhone: '(425) 555-0159',
      school: 'CPNW University',
      program: 'BSN',
      emergencyName: 'Casey Student',
      emergencyPhone: '(425) 555-0188',
      address: '400 Bellevue Way',
      city: 'Bellevue',
      state: 'WA',
      zip: '98004'
    }
  },
  {
    email: 'student.surgtech.uni@cpnw.org',
    name: 'Riley Student',
    role: 'student',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW University'],
    programs: ['SurgTech'],
    cohort: 'Surgical Technology – Winter 2026',
    reqs: { cpnw: 'complete', ed: 'complete', hc: 'incomplete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'HIPAA.pdf', req: 'HIPAA', date: '2025-02-01' }],
    profile: {
      firstName: 'Riley',
      lastName: 'Student',
      emailUsername: 'student.surgtech.uni@cpnw.org',
      altEmail: 'riley.student@cpnw.org',
      primaryPhone: '(425) 555-0174',
      school: 'CPNW University',
      program: 'SurgTech',
      emergencyName: 'Avery Student',
      emergencyPhone: '(425) 555-0193',
      address: '200 108th Ave',
      city: 'Bellevue',
      state: 'WA',
      zip: '98004'
    }
  },
  {
    email: 'student.adn.edu@cpnw.org',
    name: 'Casey Student',
    role: 'student',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['ADN'],
    cohort: 'ADN – Fall 2025',
    reqs: { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'BackgroundCheck.pdf', req: 'Background check', date: '2025-02-12' }],
    profile: {
      firstName: 'Casey',
      lastName: 'Student',
      emailUsername: 'student.adn.edu@cpnw.org',
      altEmail: 'casey.student@cpnw.org',
      primaryPhone: '(253) 555-0128',
      school: 'CPNW Education',
      program: 'ADN',
      emergencyName: 'Skyler Student',
      emergencyPhone: '(253) 555-0192',
      address: '709 Market St',
      city: 'Tacoma',
      state: 'WA',
      zip: '98402'
    }
  },
  {
    email: 'student.bsn.edu@cpnw.org',
    name: 'Skyler Student',
    role: 'student',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['BSN'],
    cohort: 'BSN – Spring 2026',
    reqs: { cpnw: 'expiring', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'Immunization.pdf', req: 'Immunization', date: '2025-02-03' }],
    profile: {
      firstName: 'Skyler',
      lastName: 'Student',
      emailUsername: 'student.bsn.edu@cpnw.org',
      altEmail: 'skyler.student@cpnw.org',
      primaryPhone: '(253) 555-0166',
      school: 'CPNW Education',
      program: 'BSN',
      emergencyName: 'Morgan Student',
      emergencyPhone: '(253) 555-0191',
      address: '112 Pacific Ave',
      city: 'Tacoma',
      state: 'WA',
      zip: '98402'
    }
  },
  {
    email: 'student.radtech.edu@cpnw.org',
    name: 'Avery Student',
    role: 'student',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['RadTech'],
    cohort: 'Radiologic Technology – Winter 2026',
    reqs: { cpnw: 'complete', ed: 'incomplete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'HIPAA.pdf', req: 'HIPAA', date: '2025-01-30' }],
    profile: {
      firstName: 'Avery',
      lastName: 'Student',
      emailUsername: 'student.radtech.edu@cpnw.org',
      altEmail: 'avery.student@cpnw.org',
      primaryPhone: '(206) 555-0148',
      school: 'CPNW Education',
      program: 'RadTech',
      emergencyName: 'Riley Student',
      emergencyPhone: '(206) 555-0183',
      address: '715 2nd Ave',
      city: 'Seattle',
      state: 'WA',
      zip: '98104'
    }
  },
  {
    email: 'faculty.adn.uni@cpnw.org',
    name: 'Pat Faculty',
    role: 'faculty',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW University'],
    programs: ['ADN'],
    cohort: 'ADN – Fall 2025',
    reqs: { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'FacultyCert.pdf', req: 'Faculty Credential', date: '2025-02-12' }],
    profile: {
      firstName: 'Pat',
      lastName: 'Faculty',
      emailUsername: 'faculty.adn.uni@cpnw.org',
      altEmail: 'pat.faculty@cpnw.org',
      primaryPhone: '(425) 555-0140',
      school: 'CPNW University',
      program: 'ADN',
      emergencyName: 'Drew Faculty',
      emergencyPhone: '(425) 555-0197',
      address: '1111 Market St',
      city: 'Seattle',
      state: 'WA',
      zip: '98121'
    }
  },
  {
    email: 'faculty.bsn.uni@cpnw.org',
    name: 'Quinn Faculty',
    role: 'faculty',
    permissions: { canCoordinate: true, canDelete: true },
    schools: ['CPNW University'],
    programs: ['BSN'],
    cohort: 'BSN – Spring 2026',
    reqs: { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'AdminAccess.pdf', req: 'Admin Approval', date: '2025-02-11' }],
    profile: {
      firstName: 'Quinn',
      lastName: 'Faculty',
      emailUsername: 'faculty.bsn.uni@cpnw.org',
      altEmail: 'quinn.faculty@cpnw.org',
      primaryPhone: '(425) 555-0136',
      school: 'CPNW University',
      program: 'BSN',
      emergencyName: 'Emery Faculty',
      emergencyPhone: '(425) 555-0196',
      address: '888 108th Ave',
      city: 'Bellevue',
      state: 'WA',
      zip: '98004'
    }
  },
  {
    email: 'faculty.surgtech.uni@cpnw.org',
    name: 'Rowan Faculty',
    role: 'faculty',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW University'],
    programs: ['SurgTech'],
    cohort: 'Surgical Technology – Winter 2026',
    reqs: { cpnw: 'complete', ed: 'incomplete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'FacultyCert.pdf', req: 'Faculty Credential', date: '2025-02-02' }],
    profile: {
      firstName: 'Rowan',
      lastName: 'Faculty',
      emailUsername: 'faculty.surgtech.uni@cpnw.org',
      altEmail: 'rowan.faculty@cpnw.org',
      primaryPhone: '(360) 555-0142',
      school: 'CPNW University',
      program: 'SurgTech',
      emergencyName: 'Pat Faculty',
      emergencyPhone: '(360) 555-0186',
      address: '450 Capitol Way',
      city: 'Olympia',
      state: 'WA',
      zip: '98501'
    }
  },
  {
    email: 'faculty.adn.edu@cpnw.org',
    name: 'Drew Faculty',
    role: 'faculty',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['ADN'],
    cohort: 'ADN – Fall 2025',
    reqs: { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'FacultyCert.pdf', req: 'Faculty Credential', date: '2025-02-12' }],
    profile: {
      firstName: 'Drew',
      lastName: 'Faculty',
      emailUsername: 'faculty.adn.edu@cpnw.org',
      altEmail: 'drew.faculty@cpnw.org',
      primaryPhone: '(253) 555-0152',
      school: 'CPNW Education',
      program: 'ADN',
      emergencyName: 'Skyler Faculty',
      emergencyPhone: '(253) 555-0195',
      address: '200 Broadway',
      city: 'Tacoma',
      state: 'WA',
      zip: '98402'
    }
  },
  {
    email: 'faculty.bsn.edu@cpnw.org',
    name: 'Emery Faculty',
    role: 'faculty',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['BSN'],
    cohort: 'BSN – Spring 2026',
    reqs: { cpnw: 'expiring', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'BLS.pdf', req: 'BLS', date: '2025-01-27' }],
    profile: {
      firstName: 'Emery',
      lastName: 'Faculty',
      emailUsername: 'faculty.bsn.edu@cpnw.org',
      altEmail: 'emery.faculty@cpnw.org',
      primaryPhone: '(253) 555-0170',
      school: 'CPNW Education',
      program: 'BSN',
      emergencyName: 'Jordan Faculty',
      emergencyPhone: '(253) 555-0184',
      address: '611 Market St',
      city: 'Tacoma',
      state: 'WA',
      zip: '98402'
    }
  },
  {
    email: 'faculty.radtech.edu@cpnw.org',
    name: 'Parker Faculty',
    role: 'faculty',
    permissions: { canCoordinate: false, canDelete: false },
    schools: ['CPNW Education'],
    programs: ['RadTech'],
    cohort: 'Radiologic Technology – Winter 2026',
    reqs: { cpnw: 'complete', ed: 'incomplete', hc: 'complete', oig: 'pass', sam: 'pass' },
    docItems: [{ file: 'HIPAA.pdf', req: 'HIPAA', date: '2025-02-04' }],
    profile: {
      firstName: 'Parker',
      lastName: 'Faculty',
      emailUsername: 'faculty.radtech.edu@cpnw.org',
      altEmail: 'parker.faculty@cpnw.org',
      primaryPhone: '(206) 555-0168',
      school: 'CPNW Education',
      program: 'RadTech',
      emergencyName: 'Riley Faculty',
      emergencyPhone: '(206) 555-0181',
      address: '1501 1st Ave',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    }
  }
];

window.CPNW = window.CPNW || {};
window.CPNW.demoPeople = cpnwDemoPeople;
window.CPNW.reviewerRoster = (() => {
  const roster = [];
  const demoPeople = Array.isArray(cpnwDemoPeople) ? cpnwDemoPeople : [];
  demoPeople.forEach((person) => {
    if (['student','faculty'].includes(person.role)){
      roster.push(person);
    }
  });

  const TODAY = new Date();
  const FALL_START_MONTH = 7;
  const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
  const TERMS = ['Fall', 'Winter', 'Spring', 'Summer'];
  const termAdjust = { Fall: 3, Winter: 1, Spring: 0, Summer: -2 };
  const programDefs = [
    { id: 'adn', name: 'ADN', base: 10 },
    { id: 'bsn', name: 'BSN', base: 12 }
  ];

  programDefs.forEach((p, idx) => {
    TERMS.forEach((term, termIdx) => {
      const count = Math.max(8, p.base + termAdjust[term]);
      for (let i = 0; i < count; i++){
        const id = `dvs-${p.id}-${idx}-${termIdx}-${i + 1}`;
        roster.push({
          name: `Student ${id.toUpperCase()}`,
          email: `student.${p.id}.${termIdx}.${i + 1}@dvs.cpnw.org`,
          role: 'student',
          schools: [p.id === 'adn' ? 'CPNW University' : 'CPNW Education'],
          programs: [p.name],
          profile: { school: p.id === 'adn' ? 'CPNW University' : 'CPNW Education', program: p.name }
        });
      }
    });
  });

  return roster;
})();

(function(){
  const currentUser = window.CPNW && typeof window.CPNW.getCurrentUser === 'function'
    ? window.CPNW.getCurrentUser()
    : null;
  if (!currentUser) return;
  const demo = cpnwDemoPeople.find(p => p.email.toLowerCase() === currentUser.email?.toLowerCase());
  if (!demo) return;

  const merged = {
    ...demo,
    ...currentUser,
    permissions: { ...demo.permissions, ...currentUser.permissions },
    programs: (currentUser.programs && currentUser.programs.length) ? currentUser.programs : demo.programs,
    schools: (currentUser.schools && currentUser.schools.length) ? currentUser.schools : demo.schools,
    profile: { ...demo.profile, ...currentUser.profile }
  };
  window.CPNW.currentUser = merged;
  try{
    localStorage.setItem('cpnw-current-user', JSON.stringify(merged));
  }catch(err){}
})();

// Login modal loader + trigger
(function(){
  const trigger = document.getElementById('loginTrigger');
  if (!trigger) return;

  let modalEl = null;
  let modalInstance = null;
  const fakeUsers = cpnwDemoPeople.map(person => ({
    email: person.email,
    password: '123',
    role: person.role,
    name: person.name,
    permissions: person.permissions || {},
    schools: person.schools || [],
    programs: person.programs || []
  }));

  const fallbackHTML = `
    <div
      class="modal fade"
      id="loginModal"
      tabindex="-1"
      aria-labelledby="loginModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="loginModalLabel">Login</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <div
              class="alert alert-dismissible fade show d-none"
              role="alert"
              data-login-status
            >
              <span data-login-status-text></span>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="alert"
                aria-label="Close"
              ></button>
            </div>
            <form id="loginForm">
              <div class="mb-3">
                <label class="form-label" for="loginEmail">Email address</label>
                <input
                  type="email"
                  class="form-control"
                  id="loginEmail"
                  name="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div class="mb-3">
                <label class="form-label" for="loginPassword">Password</label>
                <input
                  type="password"
                  class="form-control"
                  id="loginPassword"
                  name="password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div class="d-flex justify-content-end align-items-center mb-3">
                <a href="#forgot" class="small text-decoration-none">Forgot Password?</a>
              </div>
              <button type="submit" class="btn btn-cpnw btn-cpnw-primary w-100">
                Continue
              </button>
            </form>
          </div>
          <div class="modal-footer justify-content-center">
            <p class="small m-0">
              New to CPNW?
              <a href="#register" class="fw-semibold text-decoration-none" data-register-trigger>
                Create an account</a
              >
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  function attachLoginHandlers(modal){
    const form = modal.querySelector('#loginForm');
    const emailInput = modal.querySelector('#loginEmail');
    const passwordInput = modal.querySelector('#loginPassword');
    const statusBox = modal.querySelector('[data-login-status]');
    const statusText = modal.querySelector('[data-login-status-text]');
    if (!form || !emailInput || !passwordInput || !statusBox || !statusText) return;

    function setStatus(type, message){
      statusBox.classList.remove('d-none', 'alert-success', 'alert-danger');
      statusBox.classList.add(`alert-${type}`);
      statusText.textContent = message;
    }

    modal.addEventListener('shown.bs.modal', () => {
      statusBox.classList.add('d-none');
      form.reset();
      emailInput.focus();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const pwd = passwordInput.value;
      const user = fakeUsers.find(u => u.email.toLowerCase() === email);
      if (!user || user.password !== pwd){
        setStatus('danger', 'Invalid email or password.');
        return;
      }
      const demoRecord = cpnwDemoPeople.find(p => p.email.toLowerCase() === user.email.toLowerCase());
      const currentUser = demoRecord
        ? {
          email: demoRecord.email,
          role: demoRecord.role,
          name: demoRecord.name,
          permissions: demoRecord.permissions || {},
          schools: demoRecord.schools || [],
          programs: demoRecord.programs || [],
          profile: demoRecord.profile || {},
          reqs: demoRecord.reqs || {},
          cohort: demoRecord.cohort || ''
        }
        : {
          email: user.email,
          role: user.role,
          name: user.name,
          permissions: user.permissions || {},
          schools: user.schools || [],
          programs: user.programs || []
        };
      try{
        localStorage.setItem('cpnw-current-user', JSON.stringify(currentUser));
        window.CPNW = window.CPNW || {};
        window.CPNW.currentUser = currentUser;
      }catch(err){
        console.warn('Unable to persist current user.', err);
      }
      let target = '';
      if (user.role === 'education'){
        target = user.permissions?.canCoordinate
          ? 'views/dashboard-education.html'
          : 'views/education-no-access.html';
      }else if (user.role === 'faculty'){
        target = user.permissions?.canCoordinate
          ? 'views/dashboard-education.html'
          : 'views/student-views/dashboard-student.html';
      }else if (user.role === 'student'){
        target = 'views/student-views/dashboard-student.html';
      }else if (user.role === 'healthcare'){
        target = 'views/healthcare-views/dashboard-healthcare.html';
      }else if (user.role === 'cpnw-reviewer'){
        target = 'views/dashboard-cpnw-reviewer.html';
      }
      if (!target){
        setStatus('danger', 'No dashboard available for this role yet.');
        return;
      }
      setStatus('success', `Welcome back, ${user.name}! Redirecting...`);
      setTimeout(() => {
        window.location.href = target;
      }, 900);
    });
  }

  async function ensureModal(){
    if (modalEl) return;
    // Prefer existing markup in DOM; otherwise create from fallback.
    const existing = document.getElementById('loginModal');
    if (existing){
      modalEl = existing;
    }else{
      const wrap = document.createElement('div');
      wrap.innerHTML = fallbackHTML;
      const modal = wrap.querySelector('.modal');
      if (!modal) throw new Error('Login modal markup missing');
      document.body.appendChild(modal);
      modalEl = modal;
    }
    modalInstance = new bootstrap.Modal(modalEl);
    attachLoginHandlers(modalEl);
    modalEl.addEventListener('hidden.bs.modal', () => {
      const form = modalEl.querySelector('form');
      if (form) form.reset();
    });
  }

  trigger.addEventListener('click', async (event) => {
    event.preventDefault();
    try{
      await ensureModal();
      (modalInstance ||= new bootstrap.Modal(modalEl)).show();
    }catch(err){
      console.error(err);
    }
  });
})();

// Register modal loader + trigger
(function(){
  const TRIGGER_SELECTOR = '[data-register-trigger], a[href="#register"]';
  let modalEl = null;
  let modalInstance = null;

  const fallbackHTML = `
    <div
      class="modal fade"
      id="registerModal"
      tabindex="-1"
      aria-labelledby="registerModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <div>
              <p class="text-uppercase fw-bold cpnw-ls-08 cpnw-fs-75 mb-1">
                Register
              </p>
              <h2 class="modal-title h4 fw-semibold mb-0" id="registerModalLabel">
                Register
              </h2>
            </div>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body pt-2">
            <div class="row g-3 g-lg-4">
              <div class="col-12 col-lg-5">
              <div class="cpnw-shell p-3 p-md-4 h-100">
                <h3 class="h5 fw-semibold mb-2">Getting Started</h3>
                <p class="small mb-2">
                  <a
                    class="text-decoration-none fw-semibold"
                    href="https://cpnw.blob.core.windows.net/documents/docDownloads/Statewide/regInstructions.pdf?638537475462634264"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CLICK HERE TO DOWNLOAD STEP BY STEP INSTRUCTIONS BEFORE YOU BEGIN.
                  </a>
                </p>
                <p class="small text-body-secondary mb-3">
                  We recommend using a desktop or laptop computer for your registration. Older
                  smartphones and tablets may cause errors.
                </p>
                <ol class="small text-body-secondary ps-3 mb-4">
                  <li class="mb-2">
                    Enter the access code provided by your organization. The code connects you
                    with your program of study and school.
                  </li>
                  <li class="mb-2">
                    Enter your email address, which will be your account username. Once confirmed,
                    it cannot be changed.
                  </li>
                  <li class="mb-2">
                    Create and confirm your password. It must be a minimum of 10 characters and
                    include one uppercase letter, one lowercase letter, one number, and one special
                    character (! @ # $ &amp; * _ ?).
                  </li>
                  <li class="mb-2">
                    Set up your two-step authentication preferences. By choosing Text Message and
                    providing a text-enabled phone number, you consent to receive SMS messages from
                    CPNW for account verification.
                  </li>
                  <li>
                    For printable registration instructions, download step-by-step instructions
                    <a
                      class="text-decoration-none fw-semibold"
                      href="https://cpnw.blob.core.windows.net/documents/docDownloads/Statewide/regInstructions.pdf?638477018911319440"
                      target="_blank"
                      rel="noreferrer"
                    >
                      here.
                    </a>
                  </li>
                </ol>

                <div class="cpnw-shell-inner p-3">
                  <div class="small text-uppercase cpnw-ls-08 text-body-secondary mb-2">
                    Access code guide
                  </div>
                  <p class="small text-body-secondary mb-3">
                    Codes follow the format <span class="fw-semibold">ProgramCode-RoleCode</span>.
                    The program code links you to a school + program. The role code assigns your
                    account type.
                  </p>
                  <div class="d-grid gap-2 small mb-3">
                    <div class="d-flex justify-content-between">
                      <span>Healthcare</span><span class="fw-semibold">87</span>
                    </div>
                    <div class="d-flex justify-content-between">
                      <span>Education Coordinator</span><span class="fw-semibold">58</span>
                    </div>
                    <div class="d-flex justify-content-between">
                      <span>Faculty</span><span class="fw-semibold">27</span>
                    </div>
                    <div class="d-flex justify-content-between">
                      <span>Student</span><span class="fw-semibold">36</span>
                    </div>
                  </div>
                  <div class="small text-uppercase cpnw-ls-08 text-body-secondary mb-2">
                    Program codes
                  </div>
                  <div class="small d-grid gap-2" data-program-code-list></div>
                </div>
              </div>
            </div>
              <div class="col-12 col-lg-7">
                <div
                  class="alert alert-dismissible fade show d-none"
                  role="alert"
                  data-register-status
                >
                  <span data-register-status-text></span>
                  <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="alert"
                    aria-label="Close"
                  ></button>
                </div>

                <form id="registerForm">
                  <div class="mb-3">
                  <label class="form-label" for="registerAccessCode">Enter Access Code</label>
                    <input
                      type="text"
                      class="form-control"
                      id="registerAccessCode"
                      name="accessCode"
                      placeholder="Access Code *"
                      autocomplete="off"
                      inputmode="numeric"
                      required
                    />
                  <div class="form-text">
                    Enter access code provided by your facility.
                  </div>
                </div>

                  <div class="cpnw-shell-inner p-3 mb-3 d-none" data-access-details>
                    <div class="small text-uppercase cpnw-ls-08 text-body-secondary mb-2">
                      Access code details
                    </div>
                    <div class="small" data-access-summary>
                      Enter a valid access code to preview your school, program, and role.
                    </div>
                  </div>

                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label" for="registerEmail">Email Address</label>
                    <input
                      type="email"
                      class="form-control"
                      id="registerEmail"
                      name="email"
                      autocomplete="username"
                      placeholder="Email *"
                      required
                    />
                    <div class="form-text">
                      Enter your preferred email. This will be your username.
                    </div>
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="registerPassword">Password</label>
                    <input
                      type="password"
                      class="form-control"
                      id="registerPassword"
                      name="password"
                      placeholder="Create Password *"
                      autocomplete="new-password"
                      value="123"
                      required
                    />
                    <div class="form-text">
                      At least 10 characters including: upper and lowercase letters, a number and a
                      special character. Demo password is preset to 123.
                    </div>
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="registerConfirmPassword">Confirm Password</label>
                    <input
                      type="password"
                      class="form-control"
                      id="registerConfirmPassword"
                      name="confirmPassword"
                      placeholder="Confirm Password *"
                      autocomplete="new-password"
                      value="123"
                      required
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="registerMfaPreference">
                      Authentication Code Delivery Preference
                    </label>
                    <select class="form-select" id="registerMfaPreference" required>
                      <option value="">Please Select</option>
                      <option value="Email">Email</option>
                      <option value="Text Message">Text Message</option>
                    </select>
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="registerCarrier">Your Cellular Provider</label>
                    <select class="form-select" id="registerCarrier">
                      <option value="">-No Cell Phone-</option>
                    </select>
                    <div class="form-text">Select your cellular provider.</div>
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="registerPhone">Text-enabled Phone</label>
                    <input
                      type="tel"
                      class="form-control"
                      id="registerPhone"
                      name="phone"
                      autocomplete="off"
                      placeholder="Text Phone (xxx)xxx-xxxx *"
                    />
                    <div class="form-text">Enter your text-enabled phone number.</div>
                  </div>
                </div>

                <div class="form-text mt-3">
                  By clicking Create Account you indicate you have read and agree to the
                  <a
                    class="text-decoration-none fw-semibold"
                    href="../terms-privacy.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CPNW Terms of Use and Privacy Policy
                  </a>
                  .
                </div>

                  <button type="submit" class="btn btn-cpnw btn-cpnw-primary w-100 mt-4">
                    Create Account
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div class="modal-footer justify-content-center">
            <p class="small m-0">
              Already have an account?
              <a href="#login" class="fw-semibold text-decoration-none" data-login-trigger>
                Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  function parseAccessCode(raw){
    const cleaned = raw.trim();
    const match = cleaned.match(/^(\d+)-(\d{2})$/);
    if (!match){
      return { error: 'Enter a code like 10011-36.' };
    }
    const role = cpnwAccessCatalog.roles[match[2]];
    if (!role){
      return { error: 'Role code not found. Use 87, 58, 27, 36, or 91.' };
    }
    const program = cpnwAccessCatalog.programLookup.get(match[1]);
    if (!program){
      if (role.key === 'cpnw-reviewer' && match[1] === '94'){
        return { program: cpnwAccessCatalog.programLookup.get('94'), role, programCode: match[1], roleCode: match[2] };
      }
      return { error: 'Program code not found. Check the first digits.' };
    }
    return { program, role, programCode: match[1], roleCode: match[2] };
  }

  const carrierOptions = ['AT&T', 'Verizon', 'T-Mobile', 'Sprint', 'US Cellular', 'Other'];

  function setStatus(modal, type, message){
    const statusBox = modal.querySelector('[data-register-status]');
    const statusText = modal.querySelector('[data-register-status-text]');
    if (!statusBox || !statusText) return;
    statusBox.classList.remove('d-none', 'alert-success', 'alert-danger');
    statusBox.classList.add(`alert-${type}`);
    statusText.textContent = message;
  }

  function clearStatus(modal){
    const statusBox = modal.querySelector('[data-register-status]');
    if (!statusBox) return;
    statusBox.classList.add('d-none');
  }

  function populateCarriers(modal){
    const select = modal.querySelector('#registerCarrier');
    if (!select) return;
    select.innerHTML = '<option value="">-No Cell Phone-</option>';
    carrierOptions.forEach((carrier) => {
      const option = document.createElement('option');
      option.value = carrier;
      option.textContent = carrier;
      select.appendChild(option);
    });
  }

  function populateProgramCodes(modal){
    const list = modal.querySelector('[data-program-code-list]');
    if (!list) return;
    list.innerHTML = '';
    cpnwAccessCatalog.schools.forEach((school) => {
      const schoolLine = document.createElement('div');
      schoolLine.className = 'fw-semibold';
      schoolLine.textContent = `${school.name} (${school.code})`;
      list.appendChild(schoolLine);
      school.programs.forEach((program) => {
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between';
        row.innerHTML = `<span>${program.abbr} — ${program.name}</span><span class="fw-semibold">${program.code}</span>`;
        list.appendChild(row);
      });
    });
  }

  function attachHandlers(modal){
    if (modal.dataset.registerBound === 'true') return;
    modal.dataset.registerBound = 'true';
    const form = modal.querySelector('#registerForm');
    const accessInput = modal.querySelector('#registerAccessCode');
    const accessDetails = modal.querySelector('[data-access-details]');
    const accessSummary = modal.querySelector('[data-access-summary]');
    const emailInput = modal.querySelector('#registerEmail');
    const passwordInput = modal.querySelector('#registerPassword');
    const confirmInput = modal.querySelector('#registerConfirmPassword');
    const mfaSelect = modal.querySelector('#registerMfaPreference');
    const carrierSelect = modal.querySelector('#registerCarrier');
    const phoneInput = modal.querySelector('#registerPhone');
    const loginLink = modal.querySelector('[data-login-trigger]');

    if (loginLink){
      loginLink.addEventListener('click', (event) => {
        event.preventDefault();
        const instance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
        instance.hide();
        const loginTrigger = document.getElementById('loginTrigger');
        if (loginTrigger) loginTrigger.click();
      });
    }

    function updateSummary(){
      if (!accessInput || !accessSummary || !accessDetails) return;
      const raw = accessInput.value.trim();
      if (!raw){
        accessDetails.classList.add('d-none');
        return;
      }
      const result = parseAccessCode(raw);
      if (result.error){
        accessDetails.classList.remove('d-none');
        accessSummary.textContent = 'Sorry, that code is not valid, please contact your programs clinical coordinator.';
        return;
      }
      accessDetails.classList.remove('d-none');
      accessSummary.innerHTML = `
        <div class="fw-semibold">
          You are registering as a ${result.role.label} in the ${result.program.name} at ${result.program.schoolName}.
        </div>
      `;
    }

    function updateMfaState(){
      if (!mfaSelect) return;
      const isText = mfaSelect.value === 'Text Message';
      if (carrierSelect) carrierSelect.disabled = !isText;
      if (phoneInput) phoneInput.disabled = !isText;
    }

    function formatPhoneInput(value){
      const digits = value.replace(/\D/g, '').slice(0, 10);
      if (!digits) return '';
      if (digits.length < 4) return `(${digits}`;
      if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    accessInput?.addEventListener('input', updateSummary);
    mfaSelect?.addEventListener('change', updateMfaState);
    phoneInput?.addEventListener('input', (event) => {
      event.target.value = formatPhoneInput(event.target.value);
    });

    modal.addEventListener('shown.bs.modal', () => {
      clearStatus(modal);
      form?.reset();
      populateCarriers(modal);
      populateProgramCodes(modal);
      updateSummary();
      updateMfaState();
      accessInput?.focus();
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = parseAccessCode(accessInput?.value || '');
      if (result.error){
        setStatus(modal, 'danger', 'Sorry, that code is not valid, please contact your programs clinical coordinator.');
        return;
      }
      if (!emailInput?.value.trim()){
        setStatus(modal, 'danger', 'Email is required.');
        return;
      }
      if (passwordInput?.value !== confirmInput?.value){
        setStatus(modal, 'danger', 'Confirm password does not match.');
        return;
      }
      if (!mfaSelect?.value){
        setStatus(modal, 'danger', 'Select an authentication delivery preference.');
        return;
      }
      if (mfaSelect.value === 'Text Message'){
        if (!carrierSelect?.value){
          setStatus(modal, 'danger', 'Select your cellular provider.');
          return;
        }
        if (!phoneInput?.value.trim()){
          setStatus(modal, 'danger', 'Enter a text-enabled phone number.');
          return;
        }
      }
      setStatus(modal, 'success', 'Account created (demo). Use password 123 to sign in.');
      setTimeout(() => {
        const instance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
        instance.hide();
      }, 900);
    });
  }

  function ensureModal(){
    if (modalEl) return modalEl;
    const existing = document.getElementById('registerModal');
    if (existing){
      modalEl = existing;
    }else{
      const wrap = document.createElement('div');
      wrap.innerHTML = fallbackHTML;
      const modal = wrap.querySelector('.modal');
      if (!modal) return null;
      document.body.appendChild(modal);
      modalEl = modal;
    }
    modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    attachHandlers(modalEl);
    return modalEl;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(TRIGGER_SELECTOR);
    if (!trigger) return;
    event.preventDefault();
    const modal = ensureModal();
    if (!modalInstance || !modal) return;

    const loginModal = document.getElementById('loginModal');
    if (loginModal){
      const loginInstance = bootstrap.Modal.getInstance(loginModal);
      loginInstance?.hide();
    }

    modalInstance.show();
  });
})();

// Get Started (Students) modal
(function(){
  const TRIGGER_SELECTOR = '[data-student-get-started-trigger], a[href="#get-started-students"]';

  let modalEl = null;
  let modalInstance = null;

  const fallbackHTML = `
    <div
      class="modal fade"
      id="studentGetStartedModal"
      tabindex="-1"
      aria-labelledby="studentGetStartedModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <div>
              <p class="text-uppercase fw-bold cpnw-ls-08 cpnw-fs-75 mb-1">Get Started</p>
              <h2 class="modal-title h4 fw-semibold mb-0" id="studentGetStartedModalLabel">
                Registration is as easy as one, two, three.
              </h2>
            </div>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body pt-2">
            <div class="cpnw-shell p-3 p-md-4">
              <div class="d-grid gap-3">
                <div class="d-flex gap-3 align-items-start">
                  <div
                    class="rounded-circle border d-flex align-items-center justify-content-center flex-shrink-0"
                    style="width: 40px; height: 40px;"
                    aria-hidden="true"
                  >
                    <span class="fw-semibold">1</span>
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold mb-1">It starts with a code from your school.</div>
                    <p class="small text-body-secondary mb-0">
                      Students and faculty follow the same process to create an account. It all starts with an access code provided by
                      your school. Begin by selecting “Register” and filling in the requested information. The code is the first step
                      on the registration page.
                    </p>
                  </div>
                  <div class="d-none d-md-flex align-items-center justify-content-center flex-shrink-0" style="width: 56px;">
                    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </div>
                </div>

                <hr class="my-1" />

                <div class="d-flex gap-3 align-items-start">
                  <div
                    class="rounded-circle border d-flex align-items-center justify-content-center flex-shrink-0"
                    style="width: 40px; height: 40px;"
                    aria-hidden="true"
                  >
                    <span class="fw-semibold">2</span>
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold mb-1">Your account will be created.</div>
                    <p class="small text-body-secondary mb-0">
                      During registration you’ll create your username, password, and user profile. Your information is forwarded to your
                      school’s CPNW coordinator for approval, which can take up to 24 hours. If you haven’t heard back within a day,
                      contact the coordinator listed in your confirmation email.
                    </p>
                  </div>
                  <div class="d-none d-md-flex align-items-center justify-content-center flex-shrink-0" style="width: 56px;">
                    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 5h16v10H4z" stroke="currentColor" stroke-width="1.5" />
                      <path d="M9 19h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                      <path d="M12 15v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </div>
                </div>

                <hr class="my-1" />

                <div class="d-flex gap-3 align-items-start">
                  <div
                    class="rounded-circle border d-flex align-items-center justify-content-center flex-shrink-0"
                    style="width: 40px; height: 40px;"
                    aria-hidden="true"
                  >
                    <span class="fw-semibold">3</span>
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold mb-1">Sign into your account.</div>
                    <p class="small text-body-secondary mb-0">
                      When you sign in, you’ll enter your password and then be asked for an authentication code sent to your phone or
                      email. Two-step verification is an extra layer of security to protect your personal information.
                    </p>
                  </div>
                  <div class="d-none d-md-flex align-items-center justify-content-center flex-shrink-0" style="width: 56px;">
                    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M10 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      <path d="M9.5 7h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div class="d-flex flex-wrap gap-2 justify-content-end mt-4">
                <a class="btn btn-outline-secondary btn-sm btn-cpnw" href="#register" data-bs-dismiss="modal">
                  Register
                </a>
                <a class="btn btn-cpnw btn-cpnw-primary btn-sm" href="#login" id="studentGetStartedLoginBtn" data-bs-dismiss="modal">
                  Login
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  function ensureModal(){
    if (modalEl) return modalEl;
    const existing = document.getElementById('studentGetStartedModal');
    if (existing){
      modalEl = existing;
    }else{
      const wrap = document.createElement('div');
      wrap.innerHTML = fallbackHTML;
      const modal = wrap.querySelector('.modal');
      if (!modal) return null;
      document.body.appendChild(modal);
      modalEl = modal;
    }
    modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

    // If the site has a login modal trigger, make the Login button open it.
    const loginBtn = modalEl.querySelector('#studentGetStartedLoginBtn');
    loginBtn?.addEventListener('click', (e) => {
      const trigger = document.getElementById('loginTrigger');
      if (!trigger) return;
      e.preventDefault();
      trigger.click();
    });

    return modalEl;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(TRIGGER_SELECTOR);
    if (!trigger) return;
    event.preventDefault();
    const modal = ensureModal();
    if (!modalInstance || !modal) return;
    modalInstance.show();
  });
})();

// Faculty admin view switcher
(function(){
  const buttons = Array.from(document.querySelectorAll('[data-faculty-view-btn]'));
  const panels = Array.from(document.querySelectorAll('[data-faculty-view]'));
  if (!buttons.length || !panels.length) return;

  function setView(view){
    panels.forEach((panel) => {
      panel.classList.toggle('d-none', panel.dataset.facultyView !== view);
    });
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.facultyViewBtn === view);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.facultyViewBtn));
  });

  setView('admin');
})();
