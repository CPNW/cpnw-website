// Year + theme toggle using Bootstrap 5.3 theme attribute
document.getElementById('y').textContent = new Date().getFullYear();

(function(){
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');

  const STORAGE_KEY = 'cpnw-theme';
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

  function applyTheme(theme){
    root.setAttribute('data-bs-theme', theme);
    if (icon && label){
      const isLight = theme === 'light';
      icon.textContent = isLight ? '☀️' : '🌙';
      label.textContent = isLight ? 'Light' : 'Dark';
    }
  }

  let saved = null;
  try{ saved = localStorage.getItem(STORAGE_KEY); }catch(e){}
  const initial = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(initial);

  if (btn){
    btn.addEventListener('click', function(){
      const current = root.getAttribute('data-bs-theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try{ localStorage.setItem(STORAGE_KEY, next); }catch(e){}
    });
  }
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

// Login modal loader + trigger
(function(){
  const trigger = document.getElementById('loginTrigger');
  if (!trigger) return;

  let modalEl = null;
  let modalInstance = null;

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
            <form>
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

  async function ensureModal(){
    if (modalEl) return;

    let html = null;
    try{
      const res = await fetch('views/login.html', {cache: 'no-cache'});
      if (!res.ok) throw new Error('Unable to load login modal');
      html = await res.text();
    }catch(err){
      console.warn('Falling back to inline login modal:', err);
      html = fallbackHTML;
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const modal = wrap.querySelector('.modal');
    if (!modal) throw new Error('Login modal markup missing');
    document.body.appendChild(modal);
    modalEl = modal;
    modalInstance = new bootstrap.Modal(modalEl);
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
