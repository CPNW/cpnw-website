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
  const modalEl = document.getElementById('contactModal');
  if (!modalEl) return;

  // Prevent anchor triggers (e.g., footer link) from jumping the page.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-bs-target="#contactModal"]');
    if (!link) return;
    event.preventDefault();
  });

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
    student: 'views/dashboard-student.html',
    faculty: 'views/dashboard-student.html', // same experience as student
    'faculty-admin': 'views/dashboard-faculty-admin.html',
    healthcare: 'views/dashboard-healthcare.html'
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
