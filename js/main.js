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

// Login modal loader + trigger
(function(){
  const trigger = document.getElementById('loginTrigger');
  if (!trigger) return;

  let modalEl = null;
  let modalInstance = null;
  const fakeUsers = [
    { email: 'edu@example.com', password: 'Password123!', role: 'education', name: 'Alex Educator' },
    { email: 'student@example.com', password: 'Student123!', role: 'student', name: 'Sam Student' },
    { email: 'faculty@example.com', password: 'Faculty123!', role: 'faculty', name: 'Fran Faculty' },
    { email: 'facultyadmin@example.com', password: 'Admin123!', role: 'faculty-admin', name: 'Avery Admin Faculty' },
    { email: 'health@example.com', password: 'Health123!', role: 'healthcare', name: 'Harper Health' }
  ];
  const roleRoutes = {
    education: 'views/dashboard-education.html',
    student: 'views/student-views/dashboard-student.html',
    faculty: 'views/student-views/dashboard-student.html', // same experience as student
    'faculty-admin': 'views/dashboard-faculty-admin.html',
    healthcare: 'views/healthcare-views/dashboard-healthcare.html'
  };

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
              <a href="#register" class="fw-semibold text-decoration-none"
                >Create an account</a
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
      const target = roleRoutes[user.role];
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
