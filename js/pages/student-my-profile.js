
    (function(){
      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;
      const profileSuffix = currentUser?.email ? currentUser.email.toLowerCase() : 'default';
      const PROFILE_KEY = `cpnw-my-profile-${profileSuffix}`;
      const PHOTO_KEY = `cpnw-my-profile-photo-${profileSuffix}`;

      const els = {
        form: document.getElementById('profileForm'),
        saved: document.getElementById('profileSaved'),
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        middleInitial: document.getElementById('middleInitial'),
        emailUsername: document.getElementById('emailUsername'),
        altEmail: document.getElementById('altEmail'),
        primaryPhone: document.getElementById('primaryPhone'),
        school: document.getElementById('school'),
        program: document.getElementById('program'),
        emergencyName: document.getElementById('emergencyName'),
        emergencyPhone: document.getElementById('emergencyPhone'),
        address: document.getElementById('address'),
        city: document.getElementById('city'),
        state: document.getElementById('state'),
        zip: document.getElementById('zip'),
        prevYes: document.getElementById('prevNameYes'),
        prevNo: document.getElementById('prevNameNo'),
        addPrev: document.getElementById('addPrevNameBtn'),
        prevWrap: document.getElementById('prevNameWrap'),
        prevValue: document.getElementById('prevNameValue'),
        photoInput: document.getElementById('profilePhotoInput'),
        photoPreview: document.getElementById('profilePhotoPreview'),
        photoFallback: document.getElementById('profilePhotoFallback'),
        photoError: document.getElementById('photoError'),
        removePhoto: document.getElementById('removePhotoBtn')
      };

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

      function showSaved(){
        if (!els.saved) return;
        els.saved.classList.remove('d-none');
        window.setTimeout(() => els.saved.classList.add('d-none'), 3500);
      }

      function setPrevNameUI(){
        const hasPrev = !!els.prevYes?.checked;
        if (els.addPrev) els.addPrev.disabled = !hasPrev;
        if (!hasPrev){
          if (els.prevWrap) els.prevWrap.classList.add('d-none');
          if (els.prevValue) els.prevValue.value = '';
        }
      }

      function openPrevName(){
        if (els.prevWrap) els.prevWrap.classList.remove('d-none');
        els.prevValue?.focus();
      }

      function setPhotoError(message){
        if (!els.photoError) return;
        if (!message){
          els.photoError.classList.add('d-none');
          els.photoError.textContent = '';
          return;
        }
        els.photoError.classList.remove('d-none');
        els.photoError.textContent = message;
      }

      function setPhotoPreview(dataUrl){
        if (!els.photoPreview || !els.photoFallback || !els.removePhoto) return;
        if (!dataUrl){
          els.photoPreview.classList.add('d-none');
          els.photoPreview.removeAttribute('src');
          els.photoPreview.alt = '';
          els.photoFallback.classList.remove('d-none');
          els.removePhoto.disabled = true;
          return;
        }
        els.photoPreview.src = dataUrl;
        els.photoPreview.alt = 'Profile photo preview';
        els.photoPreview.classList.remove('d-none');
        els.photoFallback.classList.add('d-none');
        els.removePhoto.disabled = false;
      }

      function initDefaults(){
        const nameParts = (currentUser?.name || '').split(' ').filter(Boolean);
        const profileDefaults = currentUser?.profile || {};
        const defaults = {
          firstName: profileDefaults.firstName || nameParts[0] || 'Alex',
          lastName: profileDefaults.lastName || nameParts.slice(1).join(' ') || 'Educator',
          middleInitial: profileDefaults.middleInitial || '',
          emailUsername: profileDefaults.emailUsername || currentUser?.email || 'alex@cpnw.org',
          altEmail: profileDefaults.altEmail || '',
          primaryPhone: profileDefaults.primaryPhone || '',
          school: profileDefaults.school || (currentUser?.schools?.[0] || '').toUpperCase() || 'CPNW EDUCATION',
          program: profileDefaults.program || currentUser?.programs?.[0] || 'BSN',
          emergencyName: profileDefaults.emergencyName || '',
          emergencyPhone: profileDefaults.emergencyPhone || '',
          address: profileDefaults.address || '',
          city: profileDefaults.city || '',
          state: profileDefaults.state || '',
          zip: profileDefaults.zip || '',
          prevName: profileDefaults.prevName || 'no',
          prevNameValue: profileDefaults.prevNameValue || ''
        };

        const saved = loadJSON(PROFILE_KEY, null);
        const value = (saved && typeof saved === 'object') ? { ...defaults, ...saved } : defaults;

        els.firstName.value = value.firstName || '';
        els.lastName.value = value.lastName || '';
        els.middleInitial.value = value.middleInitial || '';
        els.emailUsername.value = value.emailUsername || '';
        els.altEmail.value = value.altEmail || '';
        els.primaryPhone.value = value.primaryPhone || '';
        els.school.value = value.school || '';
        els.program.value = value.program || '';
        els.emergencyName.value = value.emergencyName || '';
        els.emergencyPhone.value = value.emergencyPhone || '';
        els.address.value = value.address || '';
        els.city.value = value.city || '';
        els.state.value = value.state || '';
        els.zip.value = value.zip || '';
        if (value.prevName === 'yes'){
          els.prevYes.checked = true;
          els.prevNo.checked = false;
          if (els.addPrev) els.addPrev.disabled = false;
          if (value.prevNameValue){
            openPrevName();
            els.prevValue.value = value.prevNameValue;
          }else{
            setPrevNameUI();
          }
        }else{
          els.prevNo.checked = true;
          els.prevYes.checked = false;
          setPrevNameUI();
        }

        const savedPhoto = loadJSON(PHOTO_KEY, '');
        if (typeof savedPhoto === 'string' && savedPhoto){
          setPhotoPreview(savedPhoto);
        }else{
          setPhotoPreview('');
        }
      }

      function validate(){
        if (!els.form) return false;
        els.form.classList.add('was-validated');
        return els.form.checkValidity();
      }

      function currentPayload(){
        return {
          firstName: els.firstName.value.trim(),
          lastName: els.lastName.value.trim(),
          middleInitial: (els.middleInitial.value || '').trim().slice(0, 1),
          emailUsername: els.emailUsername.value,
          altEmail: (els.altEmail.value || '').trim(),
          primaryPhone: (els.primaryPhone.value || '').trim(),
          school: els.school.value,
          program: els.program.value,
          emergencyName: (els.emergencyName.value || '').trim(),
          emergencyPhone: (els.emergencyPhone.value || '').trim(),
          address: (els.address.value || '').trim(),
          city: (els.city.value || '').trim(),
          state: els.state.value,
          zip: (els.zip.value || '').trim(),
          prevName: els.prevYes.checked ? 'yes' : 'no',
          prevNameValue: (els.prevValue.value || '').trim()
        };
      }

      els.prevYes?.addEventListener('change', () => {
        setPrevNameUI();
      });
      els.prevNo?.addEventListener('change', () => {
        setPrevNameUI();
      });
      els.addPrev?.addEventListener('click', openPrevName);

      els.form?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate()) return;
        saveJSON(PROFILE_KEY, currentPayload());
        showSaved();
      });

      els.photoInput?.addEventListener('change', async () => {
        setPhotoError('');
        const file = els.photoInput.files && els.photoInput.files[0];
        if (!file) return;
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const maxBytes = 5 * 1024 * 1024;
        if (!allowed.includes(file.type)){
          setPhotoError('Please upload a JPG, PNG, or WebP image.');
          els.photoInput.value = '';
          return;
        }
        if (file.size > maxBytes){
          setPhotoError('Please upload an image that is 5MB or smaller.');
          els.photoInput.value = '';
          return;
        }

        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
        if (!dataUrl){
          setPhotoError('Unable to read that file. Please try a different image.');
          els.photoInput.value = '';
          return;
        }

        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = dataUrl;
        });
        if ((dims.w || 0) < 400 || (dims.h || 0) < 400){
          setPhotoError('Image is too small. Please use at least 400×400px (recommended 800×800px).');
          els.photoInput.value = '';
          return;
        }

        saveJSON(PHOTO_KEY, dataUrl);
        setPhotoPreview(dataUrl);
        els.photoInput.value = '';
        showSaved();
      });

      els.removePhoto?.addEventListener('click', () => {
        saveJSON(PHOTO_KEY, '');
        setPhotoPreview('');
        setPhotoError('');
      });

      initDefaults();
    })();
  

