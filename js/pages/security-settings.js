
    (function(){
      const params = new URLSearchParams(window.location.search || '');
      const roleIsStudent = window.location.pathname.includes('/student-views/') || params.get('role') === 'student';
      if (!roleIsStudent) return;
      document.querySelectorAll('[data-edu-only]').forEach(el => el.classList.add('d-none'));
    })();
  


    (function(){
      const KEY = 'cpnw-security-settings-v1';

      const form = document.getElementById('securityForm');
      const saved = document.getElementById('securitySaved');
      const error = document.getElementById('securityError');
      const newPassword = document.getElementById('newPassword');
      const confirmPassword = document.getElementById('confirmPassword');
      const authPreference = document.getElementById('authPreference');
      const primaryTextPhone = document.getElementById('primaryTextPhone');
      const cellCarrier = document.getElementById('cellCarrier');

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
        }catch{
          // ignore
        }
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

      function showSaved(){
        setAlert(saved, 'Settings updated (stored locally for this demo).');
        window.setTimeout(() => setAlert(saved, ''), 3500);
      }

      function init(){
        const defaults = { authPreference: 'text', primaryTextPhone: '', cellCarrier: '' };
        const value = { ...defaults, ...(loadJSON(KEY, {}) || {}) };
        if (authPreference) authPreference.value = value.authPreference || 'text';
        if (primaryTextPhone) primaryTextPhone.value = value.primaryTextPhone || '';
        if (cellCarrier) cellCarrier.value = value.cellCarrier || '';
      }

      function validate(){
        setAlert(error, '');
        const pass = (newPassword?.value || '').trim();
        const confirm = (confirmPassword?.value || '').trim();
        if (pass || confirm){
          if (pass.length < 8){
            setAlert(error, 'New password must be at least 8 characters.');
            return false;
          }
          if (pass !== confirm){
            setAlert(error, 'Confirm New Password must match Change Password.');
            return false;
          }
        }

        const pref = authPreference?.value || 'text';
        if (pref === 'text'){
          const phone = (primaryTextPhone?.value || '').trim();
          const carrier = (cellCarrier?.value || '').trim();
          if (!phone){
            setAlert(error, 'Primary Text Phone Number is required when using Text Message.');
            return false;
          }
          if (!carrier){
            setAlert(error, 'Please select a cell carrier when using Text Message.');
            return false;
          }
        }

        return true;
      }

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate()) return;
        saveJSON(KEY, {
          authPreference: authPreference?.value || 'text',
          primaryTextPhone: (primaryTextPhone?.value || '').trim(),
          cellCarrier: (cellCarrier?.value || '').trim()
        });
        if (newPassword) newPassword.value = '';
        if (confirmPassword) confirmPassword.value = '';
        showSaved();
      });

      authPreference?.addEventListener('change', () => {
        setAlert(error, '');
      });

      init();
    })();
  

