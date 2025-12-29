
    (function(){
      const KEY = 'cpnw-healthcare-requirements-v1';
      const builderTitle = document.getElementById('builderTitle');
      const builderError = document.getElementById('builderError');
      const builderSaved = document.getElementById('builderSaved');
      const form = document.getElementById('builderForm');

      const reqName = document.getElementById('reqName');
      const reqRequiredByBtn = document.getElementById('reqRequiredByBtn');
      const reqRequiredByList = document.getElementById('reqRequiredByList');
      const reqCategory = document.getElementById('reqCategory');
      const reqFrequency = document.getElementById('reqFrequency');
      const reqAbbr = document.getElementById('reqAbbr');
      const reqAppliesToBtn = document.getElementById('reqAppliesToBtn');
      const reqAppliesToList = document.getElementById('reqAppliesToList');
      const reqStatus = document.getElementById('reqStatus');
      const autoApproveWrap = document.getElementById('autoApproveWrap');
      const reqAutoApprove = document.getElementById('reqAutoApprove');
      const reqInstructions = document.getElementById('reqInstructions');
      const linkedFilesList = document.getElementById('linkedFilesList');
      const linkedFilesEmpty = document.getElementById('linkedFilesEmpty');

      const pvName = document.getElementById('pvName');
      const pvMeta = document.getElementById('pvMeta');
      const pvStatus = document.getElementById('pvStatus');
      const pvAbbr = document.getElementById('pvAbbr');
      const pvInstructions = document.getElementById('pvInstructions');
      const pvFilesWrap = document.getElementById('pvFilesWrap');
      const pvFiles = document.getElementById('pvFiles');

      const addLinkModalEl = document.getElementById('addLinkModal');
      const linkModal = addLinkModalEl ? new bootstrap.Modal(addLinkModalEl) : null;
      const linkUrl = document.getElementById('linkUrl');
      const linkText = document.getElementById('linkText');
      const insertLinkConfirm = document.getElementById('insertLinkConfirm');
      const addLinkBtn = document.getElementById('addLinkBtn');

      const addFileModalEl = document.getElementById('addFileModal');
      const fileModal = addFileModalEl ? new bootstrap.Modal(addFileModalEl) : null;
      const fileUpload = document.getElementById('fileUpload');
      const addFileBtn = document.getElementById('addFileBtn');
      const addFileConfirm = document.getElementById('addFileConfirm');

      let editingId = '';
      let linkedFiles = [];

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
        try{ localStorage.setItem(key, JSON.stringify(value)); }catch{}
      }
      function getAll(){
        const list = loadJSON(KEY, []);
        return Array.isArray(list) ? list : [];
      }
      function saveAll(list){
        saveJSON(KEY, list);
      }
      function nowISO(){
        return new Date().toISOString().slice(0, 10);
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
        setAlert(builderSaved, 'Saved.');
        window.setTimeout(() => setAlert(builderSaved, ''), 2500);
      }

      function escapeHTML(text){
        return String(text || '').replace(/[&<>"']/g, (ch) => {
          const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
          return map[ch] || ch;
        });
      }

      function sanitizeInstructions(html){
        const allowed = new Set(['B','STRONG','I','EM','U','P','BR','UL','OL','LI','A']);
        const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
        const root = doc.body.firstElementChild;
        if (!root) return '';

        function sanitizeNode(node){
          const children = Array.from(node.childNodes);
          children.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) return;
            if (child.nodeType !== Node.ELEMENT_NODE){
              child.remove();
              return;
            }
            const tag = child.tagName;
            if (!allowed.has(tag)){
              const frag = doc.createDocumentFragment();
              while (child.firstChild) frag.appendChild(child.firstChild);
              child.replaceWith(frag);
              return;
            }
            if (tag === 'A'){
              const href = child.getAttribute('href') || '';
              child.setAttribute('href', href);
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener');
            }
            Array.from(child.attributes).forEach(attr => {
              const name = attr.name.toLowerCase();
              if (tag === 'A' && name === 'href') return;
              child.removeAttribute(attr.name);
            });
            sanitizeNode(child);
          });
        }
        sanitizeNode(root);
        return root.innerHTML;
      }

      function updateFilesUI(){
        if (!linkedFilesList || !linkedFilesEmpty) return;
        linkedFilesList.innerHTML = '';
        if (!linkedFiles.length){
          linkedFilesEmpty.classList.remove('d-none');
        }else{
          linkedFilesEmpty.classList.add('d-none');
          linkedFiles.forEach((f, idx) => {
            const li = document.createElement('li');
            li.className = 'd-flex justify-content-between align-items-center py-1 border-bottom';
            const safeName = escapeHTML(f.name || 'File');
            const sizeLabel = f.size ? ` • ${Math.round(f.size / 1024)} KB` : '';
            li.innerHTML = `
              <div class="text-truncate" style="max-width: 70%;">
                <span class="fw-semibold">${safeName}</span>
                <span class="small text-body-secondary">${sizeLabel}</span>
              </div>
              <button class="btn btn-outline-secondary btn-sm btn-cpnw" type="button" data-remove-file="${idx}">Remove</button>
            `;
            linkedFilesList.appendChild(li);
          });
        }
      }

      function statusBadge(status){
        const norm = String(status || '').toLowerCase();
        if (norm === 'active') return { text: 'Active', cls: 'text-bg-success' };
        if (norm === 'inactive') return { text: 'Inactive', cls: 'text-bg-secondary' };
        if (norm === 'retired') return { text: 'Retired', cls: 'text-bg-secondary' };
        return { text: status || '—', cls: 'text-bg-secondary' };
      }

      const appliesToOptions = [
        'Pre-Licensure Nursing, Clinical',
        'Allied Health And Professions, Clinical',
        'Post Licensure Nursing, Clinical',
        'Allied Health And Professions, Non-Clinical',
        'Post-Licensure Nursing, Non-Clinical'
      ];

      let requiredBySelection = [];
      let appliesToSelection = [];

      function getRequiredByFallback(){
        const first = reqRequiredByList?.querySelector('input[type="checkbox"]')?.value;
        return first ? [first] : ['Healthcare'];
      }

      function updateRequiredByButton(){
        if (!reqRequiredByBtn) return;
        if (!requiredBySelection.length){
          reqRequiredByBtn.textContent = 'Select facility';
          reqRequiredByBtn.removeAttribute('title');
          return;
        }
        if (requiredBySelection.length === 1){
          reqRequiredByBtn.textContent = requiredBySelection[0];
          reqRequiredByBtn.title = requiredBySelection[0];
          return;
        }
        reqRequiredByBtn.textContent = `${requiredBySelection.length} facilities selected`;
        reqRequiredByBtn.title = requiredBySelection.join(', ');
      }

      function updateAppliesToButton(){
        if (!reqAppliesToBtn) return;
        if (!appliesToSelection.length){
          reqAppliesToBtn.textContent = 'Select disciplines';
          reqAppliesToBtn.removeAttribute('title');
          return;
        }
        if (appliesToSelection.length === 1){
          reqAppliesToBtn.textContent = appliesToSelection[0];
          reqAppliesToBtn.title = appliesToSelection[0];
          return;
        }
        reqAppliesToBtn.textContent = `${appliesToSelection.length} disciplines selected`;
        reqAppliesToBtn.title = appliesToSelection.join(', ');
      }

      function createRequiredByOption(value){
        const idSafe = String(value || 'facility')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const wrap = document.createElement('div');
        wrap.className = 'form-check';
        const input = document.createElement('input');
        input.className = 'form-check-input';
        input.type = 'checkbox';
        input.id = `reqRequiredBy_${idSafe}_${Math.random().toString(16).slice(2, 6)}`;
        input.value = value;
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.setAttribute('for', input.id);
        label.textContent = value;
        wrap.appendChild(input);
        wrap.appendChild(label);
        reqRequiredByList?.appendChild(wrap);
      }

      function ensureRequiredByOption(value){
        if (!reqRequiredByList || !value) return;
        const values = Array.isArray(value) ? value : [value];
        values.forEach((item) => {
          if (!item) return;
          const exists = Array.from(reqRequiredByList.querySelectorAll('input[type="checkbox"]'))
            .some((cb) => cb.value === item);
          if (!exists){
            createRequiredByOption(item);
          }
        });
      }

      function getRequiredByValues(){
        if (requiredBySelection.length) return requiredBySelection.slice();
        return getRequiredByFallback();
      }

      function getAppliesToFallback(){
        const first = reqAppliesToList?.querySelector('input[type="checkbox"]')?.value;
        return first ? [first] : [];
      }

      function getAppliesToValues(){
        if (appliesToSelection.length) return appliesToSelection.slice();
        return getAppliesToFallback();
      }

      function refreshAppliesToSelection(){
        if (!reqAppliesToList) return;
        appliesToSelection = Array.from(reqAppliesToList.querySelectorAll('input[type="checkbox"]'))
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);
        updateAppliesToButton();
      }

      function createAppliesToOption(value){
        const idSafe = String(value || 'discipline')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const wrap = document.createElement('div');
        wrap.className = 'form-check';
        const input = document.createElement('input');
        input.className = 'form-check-input';
        input.type = 'checkbox';
        input.id = `reqAppliesTo_${idSafe}_${Math.random().toString(16).slice(2, 6)}`;
        input.value = value;
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.setAttribute('for', input.id);
        label.textContent = value;
        wrap.appendChild(input);
        wrap.appendChild(label);
        reqAppliesToList?.appendChild(wrap);
      }

      function populateAppliesToOptions(){
        if (!reqAppliesToList) return;
        reqAppliesToList.innerHTML = '';
        appliesToOptions.forEach((item) => createAppliesToOption(item));
        refreshAppliesToSelection();
      }

      function refreshRequiredBySelection(){
        if (!reqRequiredByList) return;
        requiredBySelection = Array.from(reqRequiredByList.querySelectorAll('input[type="checkbox"]'))
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);
        if (!requiredBySelection.length){
          const first = reqRequiredByList.querySelector('input[type="checkbox"]');
          if (first){
            first.checked = true;
            requiredBySelection = [first.value];
          }
        }
        updateRequiredByButton();
      }

      function populateRequiredByOptions(){
        if (!reqRequiredByList) return;
        const currentUser = window.CPNW && typeof window.CPNW.getCurrentUser === 'function'
          ? window.CPNW.getCurrentUser()
          : null;
        const facilities = currentUser && currentUser.role === 'healthcare' && currentUser.permissions?.canCoordinate
          ? (Array.isArray(currentUser.schools) ? currentUser.schools.filter(Boolean) : [])
          : [];

        reqRequiredByList.innerHTML = '';
        const items = facilities.length ? facilities : ['Healthcare'];
        items.forEach((facility) => createRequiredByOption(facility));
        refreshRequiredBySelection();
      }

      function updatePreview(){
        const name = (reqName?.value || '').trim() || 'Requirement name';
        const abbr = (reqAbbr?.value || '').trim();
        const meta = [
          getRequiredByValues().join(', '),
          (reqFrequency?.value || 'Once'),
          getAppliesToValues().join(', ')
        ].filter(Boolean).join(' • ');
        const status = reqStatus?.value || 'Active';
        const badge = statusBadge(status);

        if (pvName) pvName.textContent = name;
        if (pvMeta) pvMeta.textContent = meta;
        if (pvStatus){
          pvStatus.textContent = badge.text;
          pvStatus.className = `badge ${badge.cls}`;
        }
        if (pvAbbr){
          pvAbbr.textContent = abbr ? `Abbr: ${abbr}` : '';
        }

        const safeHTML = sanitizeInstructions(reqInstructions?.innerHTML || '');
        if (pvInstructions){
          pvInstructions.innerHTML = safeHTML || '<span class="text-body-secondary">No instructions yet.</span>';
        }

        if (pvFilesWrap && pvFiles){
          if (!linkedFiles.length){
            pvFilesWrap.classList.add('d-none');
            pvFiles.innerHTML = '';
          }else{
            pvFilesWrap.classList.remove('d-none');
            pvFiles.innerHTML = linkedFiles.map(f => {
              const url = f.url ? escapeHTML(f.url) : '#';
              return `<li><a href="${url}" download="${escapeHTML(f.name || 'file')}" target="_blank" rel="noopener" class="text-decoration-none">${escapeHTML(f.name || 'File')}</a></li>`;
            }).join('');
          }
        }
      }

      function exec(cmd){
        try{
          document.execCommand(cmd, false, null);
        }catch{
          // ignore
        }
        reqInstructions?.focus();
        updatePreview();
      }

      document.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => exec(btn.dataset.cmd));
      });

      addLinkBtn?.addEventListener('click', () => {
        if (!linkModal) return;
        if (linkUrl) linkUrl.value = '';
        if (linkText) linkText.value = '';
        linkModal.show();
      });
      insertLinkConfirm?.addEventListener('click', () => {
        const url = (linkUrl?.value || '').trim();
        if (!url){
          linkModal?.hide();
          return;
        }
        const text = (linkText?.value || '').trim();
        if (text){
          const a = `<a href="${escapeHTML(url)}">${escapeHTML(text)}</a>`;
          document.execCommand('insertHTML', false, a);
        }else{
          document.execCommand('createLink', false, url);
        }
        linkModal?.hide();
        updatePreview();
      });

      addFileBtn?.addEventListener('click', () => {
        if (!fileModal) return;
        if (fileUpload) fileUpload.value = '';
        fileModal.show();
      });
      addFileConfirm?.addEventListener('click', () => {
        const file = fileUpload?.files?.[0];
        if (!file){
          alert('Please select a file to upload.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          linkedFiles.push({
            name: file.name,
            url: reader.result || '#',
            size: file.size || 0
          });
          updateFilesUI();
          updatePreview();
          if (fileUpload) fileUpload.value = '';
          fileModal?.hide();
        };
        reader.onerror = () => {
          alert('Unable to read the file.');
        };
        reader.readAsDataURL(file);
      });

      linkedFilesList?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-remove-file]');
        if (!btn) return;
        const idx = Number(btn.dataset.removeFile);
        if (!Number.isFinite(idx)) return;
        linkedFiles.splice(idx, 1);
        updateFilesUI();
        updatePreview();
      });

      [reqName, reqCategory, reqFrequency, reqAbbr, reqStatus].forEach(el => {
        el?.addEventListener('input', updatePreview);
        if (el?.tagName === 'SELECT') el.addEventListener('change', updatePreview);
      });
      ['input','keyup','paste'].forEach(evt => reqInstructions?.addEventListener(evt, updatePreview));
      reqRequiredByList?.addEventListener('change', (e) => {
        if (!e.target || e.target.type !== 'checkbox') return;
        refreshRequiredBySelection();
        updatePreview();
      });
      reqAppliesToList?.addEventListener('change', (e) => {
        if (!e.target || e.target.type !== 'checkbox') return;
        refreshAppliesToSelection();
        updatePreview();
      });
      reqCategory?.addEventListener('change', () => {
        const isSiteOrientation = reqCategory.value === 'Site Orientations';
        if (autoApproveWrap){
          autoApproveWrap.classList.toggle('d-none', !isSiteOrientation);
        }
        if (!isSiteOrientation && reqAutoApprove){
          reqAutoApprove.checked = false;
        }
        updatePreview();
      });
      reqAutoApprove?.addEventListener('change', () => {
        if (reqAutoApprove.checked){
          alert('Enabling Auto Approval will approve this requirement automatically when a student or faculty member submits it.');
        }
      });

      function parseQuery(){
        const params = new URLSearchParams(window.location.search || '');
        return { id: params.get('id') || '' };
      }

      function loadExisting(id){
        const existing = getAll().find(r => r.id === id);
        if (!existing) return null;
        return existing;
      }

      function setFormFrom(record){
        reqName.value = record.name || '';
        const requiredBy = record.requiredBy || getRequiredByFallback();
        const requiredByList = Array.isArray(requiredBy) ? requiredBy : [requiredBy];
        ensureRequiredByOption(requiredByList);
        Array.from(reqRequiredByList?.querySelectorAll('input[type="checkbox"]') || []).forEach((cb) => {
          cb.checked = requiredByList.includes(cb.value);
        });
        refreshRequiredBySelection();
        reqCategory.value = record.category || '';
        if (autoApproveWrap){
          const isSiteOrientation = reqCategory.value === 'Site Orientations';
          autoApproveWrap.classList.toggle('d-none', !isSiteOrientation);
        }
        reqFrequency.value = record.frequency || '';
        reqAbbr.value = record.abbr || '';
        const appliesTo = record.userType || [];
        const appliesToList = Array.isArray(appliesTo) ? appliesTo : [appliesTo];
        Array.from(reqAppliesToList?.querySelectorAll('input[type="checkbox"]') || []).forEach((cb) => {
          cb.checked = appliesToList.includes(cb.value);
        });
        refreshAppliesToSelection();
        reqStatus.value = record.status || 'Active';
        if (reqAutoApprove){
          reqAutoApprove.checked = !!record.autoApprove;
        }
        reqInstructions.innerHTML = record.instructionsHTML || '';
        linkedFiles = Array.isArray(record.linkedFiles) ? record.linkedFiles.slice() : [];
        updateFilesUI();
        updatePreview();
      }

      function generateId(name){
        const base = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const suffix = Math.random().toString(16).slice(2, 8);
        return `req_${base || 'new'}_${suffix}`;
      }

      function collect(){
        const name = (reqName.value || '').trim();
        return {
          name,
          requiredBy: getRequiredByValues(),
          category: reqCategory.value || '',
          frequency: reqFrequency.value || '',
          abbr: (reqAbbr.value || '').trim().slice(0, 5),
          userType: getAppliesToValues(),
          status: reqStatus.value || 'Active',
          autoApprove: !!reqAutoApprove?.checked,
          instructionsHTML: sanitizeInstructions(reqInstructions.innerHTML || ''),
          linkedFiles: linkedFiles.slice()
        };
      }

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        setAlert(builderError, '');
        setAlert(builderSaved, '');
        form.classList.add('was-validated');

        const payload = collect();
        if (!payload.name){
          setAlert(builderError, 'Name is required.');
          reqName?.focus();
          return;
        }

        const list = getAll();
        const existing = editingId ? list.find(r => r.id === editingId) : null;
        const id = editingId || generateId(payload.name);
        const createdAt = existing?.createdAt || nowISO();
        const retiredAt = payload.status === 'Retired' ? (existing?.retiredAt || nowISO()) : '';

        const next = {
          id,
          ...payload,
          createdAt,
          retiredAt
        };

        const idx = list.findIndex(r => r.id === id);
        if (idx >= 0) list[idx] = next;
        else list.unshift(next);
        saveAll(list);

        showSaved();
        updatePreview();
        window.setTimeout(() => {
          window.location.href = 'requirements-healthcare.html';
        }, 450);
      });

      // Init
      populateRequiredByOptions();
      populateAppliesToOptions();
      const { id } = parseQuery();
      if (id){
        const existing = loadExisting(id);
        if (existing){
          editingId = id;
          if (builderTitle) builderTitle.textContent = 'Edit Requirement';
          setFormFrom(existing);
        }else{
          setAlert(builderError, 'Requirement not found. Creating a new one instead.');
        }
      }
      if (!editingId){
        setFormFrom({
          name: '',
          requiredBy: getRequiredByFallback(),
          category: '',
          frequency: '',
          abbr: '',
          userType: [],
          status: 'Active',
          autoApprove: false,
          instructionsHTML: '<p>Instructions for requirement</p>',
          linkedFiles: []
        });
      }
      updateFilesUI();
      updatePreview();
    })();
  
