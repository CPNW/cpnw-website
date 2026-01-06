
    (function(){
      const KEY = 'cpnw-education-requirements-v1';
      const builderTitle = document.getElementById('builderTitle');
      const builderError = document.getElementById('builderError');
      const builderSaved = document.getElementById('builderSaved');
      const form = document.getElementById('builderForm');

      const reqName = document.getElementById('reqName');
      const reqRequiredBy = document.getElementById('reqRequiredBy');
      const reqCategory = document.getElementById('reqCategory');
      const reqFrequency = document.getElementById('reqFrequency');
      const reqAbbr = document.getElementById('reqAbbr');
      const reqUserType = document.getElementById('reqUserType');
      const reqStatus = document.getElementById('reqStatus');
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
      const fileName = document.getElementById('fileName');
      const fileUrl = document.getElementById('fileUrl');
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
            li.innerHTML = `
              <div class="text-truncate cpnw-maxw-70">
                <span class="fw-semibold">${safeName}</span>
                <span class="small text-body-secondary">${f.url ? ` • ${escapeHTML(f.url)}` : ''}</span>
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
        return { text: 'Inactive', cls: 'text-bg-secondary' };
      }

      function normalizeStatus(status){
        const norm = String(status || '').toLowerCase();
        if (norm === 'inactive' || norm === 'retired') return 'Inactive';
        return 'Active';
      }

      function updatePreview(){
        const name = (reqName?.value || '').trim() || 'Requirement name';
        const abbr = (reqAbbr?.value || '').trim();
        const meta = [
          (reqRequiredBy?.value || 'Education'),
          (reqFrequency?.value || 'Once'),
          (reqUserType?.value || 'Student')
        ].filter(Boolean).join(' • ');
        const status = normalizeStatus(reqStatus?.value || 'Active');
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
              return `<li><a href="${url}" target="_blank" rel="noopener" class="text-decoration-none">${escapeHTML(f.name || 'File')}</a></li>`;
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
        if (fileName) fileName.value = '';
        if (fileUrl) fileUrl.value = '#';
        fileModal.show();
      });
      addFileConfirm?.addEventListener('click', () => {
        const name = (fileName?.value || '').trim();
        if (!name){
          fileModal?.hide();
          return;
        }
        linkedFiles.push({
          name,
          url: (fileUrl?.value || '').trim() || '#'
        });
        updateFilesUI();
        updatePreview();
        fileModal?.hide();
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

      [reqName, reqRequiredBy, reqCategory, reqFrequency, reqAbbr, reqUserType, reqStatus].forEach(el => {
        el?.addEventListener('input', updatePreview);
        if (el?.tagName === 'SELECT') el.addEventListener('change', updatePreview);
      });
      ['input','keyup','paste'].forEach(evt => reqInstructions?.addEventListener(evt, updatePreview));

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
        reqRequiredBy.value = record.requiredBy || 'Education';
        reqCategory.value = record.category || '';
        reqFrequency.value = record.frequency || '';
        reqAbbr.value = record.abbr || '';
        reqUserType.value = record.userType || '';
        reqStatus.value = normalizeStatus(record.status || 'Active');
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
          requiredBy: reqRequiredBy.value || 'Education',
          category: reqCategory.value || '',
          frequency: reqFrequency.value || '',
          abbr: (reqAbbr.value || '').trim().slice(0, 5),
          userType: reqUserType.value || '',
          status: normalizeStatus(reqStatus.value || 'Active'),
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

        const next = {
          id,
          ...payload,
          createdAt
        };

        const idx = list.findIndex(r => r.id === id);
        if (idx >= 0) list[idx] = next;
        else list.unshift(next);
        saveAll(list);

        showSaved();
        updatePreview();
        window.setTimeout(() => {
          window.location.href = 'requirements-education.html';
        }, 450);
      });

      // Init
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
          requiredBy: 'Education',
          category: '',
          frequency: '',
          abbr: '',
          userType: '',
          status: 'Active',
          instructionsHTML: '<p>Instructions for requirement</p>',
          linkedFiles: []
        });
      }
      updateFilesUI();
      updatePreview();
    })();
  
