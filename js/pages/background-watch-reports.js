
    (function(){
      const STORAGE_KEY = 'cpnw-bgc-watch-v1';
      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];

      const tableBody = document.getElementById('bwTableBody');
      const searchInput = document.getElementById('bwSearch');
      const programSelect = document.getElementById('bwProgram');
      const cohortSelect = document.getElementById('bwCohort');
      const statusSelect = document.getElementById('bwStatus');
      const selectAll = document.getElementById('bwSelectAll');
      const pageInfo = document.getElementById('bwPageInfo');
      const pageSizeSelect = document.getElementById('bwPageSize');
      const prevBtn = document.getElementById('bwPrev');
      const nextBtn = document.getElementById('bwNext');
      const clearFiltersBtn = document.getElementById('clearFiltersBtn');
      const selectedCountEl = document.getElementById('bwSelectedCount');
      const initiateSingleBtn = document.getElementById('initiateSingleBtn');
      const initiateGroupBtn = document.getElementById('initiateGroupBtn');

      const modalEl = document.getElementById('initiateModal');
      const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
      const initiateModalLabel = document.getElementById('initiateModalLabel');
      const initiateModalDesc = document.getElementById('initiateModalDesc');
      const initiateList = document.getElementById('initiateList');
      const initiateCount = document.getElementById('initiateCount');
      const initiateError = document.getElementById('initiateError');
      const initiateCheckr = document.getElementById('initiateCheckr');
      const initiateWatch = document.getElementById('initiateWatch');
      const checkrStandard = document.getElementById('checkrStandard');
      const checkrInternational = document.getElementById('checkrInternational');
      const confirmBtn = document.getElementById('initiateConfirmBtn');

      const selectedEmails = new Set();
      let page = 1;
      let pageSize = Number(pageSizeSelect?.value || 10);
      let sortState = { field:'name', dir:'asc' };
      let currentModalEmails = [];
      let currentModalMode = 'single';

      function isoDate(d){
        const date = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
      }

      function prettyDate(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const date = new Date(val);
        if (Number.isNaN(date.getTime())) return '<span class="text-body-secondary">—</span>';
        return date.toLocaleDateString(undefined, { year:'numeric', month:'numeric', day:'numeric' });
      }

      function loadJSON(key, fallback){
        try{
          const raw = localStorage.getItem(key);
          if (!raw) return fallback;
          const val = JSON.parse(raw);
          return val ?? fallback;
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

      function getStore(){
        const store = loadJSON(STORAGE_KEY, {});
        if (!store || typeof store !== 'object' || Array.isArray(store)) return {};
        return store;
      }

      function setStore(next){
        saveJSON(STORAGE_KEY, next);
      }

      function getRecord(email){
        const key = String(email || '').trim().toLowerCase();
        if (!key) return null;
        const store = getStore();
        const record = store[key];
        if (!record || typeof record !== 'object') return {
          checkr: { type:'', status:'', modified:'' },
          watch: { status:'', modified:'' }
        };
        return {
          checkr: {
            type: String(record.checkr?.type || ''),
            status: String(record.checkr?.status || ''),
            modified: String(record.checkr?.modified || '')
          },
          watch: {
            status: String(record.watch?.status || ''),
            modified: String(record.watch?.modified || '')
          }
        };
      }

      function patchRecord(email, patch){
        const key = String(email || '').trim().toLowerCase();
        if (!key) return;
        const store = getStore();
        const current = getRecord(key);
        const next = {
          checkr: { ...current.checkr, ...(patch.checkr || {}) },
          watch: { ...current.watch, ...(patch.watch || {}) }
        };
        store[key] = next;
        setStore(store);
      }

      function clearRecord(email){
        const key = String(email || '').trim().toLowerCase();
        if (!key) return;
        const store = getStore();
        delete store[key];
        setStore(store);
      }

      function statusBadge(status){
        const normalized = String(status || '').toLowerCase();
        const map = {
          '': { text:'N/A', cls:'text-bg-secondary' },
          'sent': { text:'Sent', cls:'text-bg-success' },
          'in-progress': { text:'In progress', cls:'text-bg-info text-dark' },
          'complete': { text:'Complete', cls:'text-bg-success' },
          'issue': { text:'Issue', cls:'text-bg-danger' }
        };
        const entry = map[normalized] || { text: status, cls:'text-bg-secondary' };
        return `<span class="badge ${entry.cls}">${entry.text}</span>`;
      }

      function checkrTypeLabel(type){
        if (type === 'standard') return 'Standard';
        if (type === 'international') return 'International/Non‑SSN';
        return '';
      }

      // Cohorts (match other admin pages)
      const programDefs = [
        { id:'BSN', base: 12, aySpan: 2 },
        { id:'ADN', base: 10, aySpan: 2 },
        { id:'Surg Tech', base: 8, aySpan: 2 }
      ];
      const termAdjust = { Fall:3, Winter:1, Spring:0, Summer:-2 };
      const cohortSeeds = [];
      programDefs.forEach(p => {
        Array.from({length:p.aySpan},(_,i)=>CURRENT_AY_START - i).forEach(ay=>{
          TERMS.forEach(term=>{
            const year = term === 'Fall' ? ay : ay + 1;
            const ayStart = term === 'Fall' ? ay : ay - 1;
            const students = Math.max(8, p.base + termAdjust[term] + (CURRENT_AY_START - ay));
            cohortSeeds.push({
              cohortLabel: `${p.id} – ${term} ${year}`,
              program: p.id,
              ayStart,
              students
            });
          });
        });
      });

      let cohorts = cohortSeeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);
      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = (cohortAPI && typeof cohortAPI.getMembershipCounts === 'function') ? cohortAPI.getMembershipCounts() : {};
      if (cohortAPI){
        cohorts = cohorts.map(c => {
          const seedKey = typeof cohortAPI.seedKeyForLabel === 'function' ? cohortAPI.seedKeyForLabel(c.cohortLabel) : `seed:${c.cohortLabel}`;
          const delta = membershipCounts[seedKey] || 0;
          return { ...c, students: c.students + delta };
        });
        if (typeof cohortAPI.listCustomCohortsLegacy === 'function'){
          const custom = cohortAPI.listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX });
          cohorts = cohorts.concat(custom);
        }
      }

      if (cohortSelect){
        const opts = ['', '__unassigned__', ...cohorts.map(c => c.cohortLabel)];
        const unique = Array.from(new Set(opts));
        cohortSelect.innerHTML = unique.map(val => {
          if (!val) return `<option value="">All cohorts</option>`;
          if (val === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
          return `<option value="${val}">${val}</option>`;
        }).join('');
      }

      // Build roster
      const roster = [];
      cohorts.forEach((c, idx) => {
        const count = Math.min(12, c.students);
        for (let i = 0; i < count; i++){
          const email = `student${idx+1}${i+1}@demo.cpnw.org`;
          let cohortLabel = c.cohortLabel;
          if (cohortAPI && typeof cohortAPI.getUserCohortLabel === 'function'){
            const override = cohortAPI.getUserCohortLabel(email);
            if (override !== null && override !== undefined){
              cohortLabel = override;
            }
          }
          const record = getRecord(email);
          roster.push({
            name: `Student ${idx+1}-${i+1}`,
            email,
            program: c.program,
            cohort: cohortLabel,
            checkr: record.checkr,
            watch: record.watch
          });
        }
      });

      function setInitiateError(message){
        if (!initiateError) return;
        if (!message){
          initiateError.classList.add('d-none');
          initiateError.textContent = '';
          return;
        }
        initiateError.classList.remove('d-none');
        initiateError.textContent = message;
      }

      function updateSelectionUI(){
        const count = selectedEmails.size;
        if (selectedCountEl) selectedCountEl.textContent = String(count);
        if (initiateSingleBtn) initiateSingleBtn.disabled = count !== 1;
        if (initiateGroupBtn) initiateGroupBtn.disabled = count <= 1;
      }

      function getActiveCheckrType(){
        if (checkrStandard && checkrStandard.checked) return 'standard';
        if (checkrInternational && checkrInternational.checked) return 'international';
        return '';
      }

      function setCheckrTypeEnabled(enabled){
        [checkrStandard, checkrInternational].forEach(el => {
          if (!el) return;
          el.disabled = !enabled;
          if (!enabled) el.checked = false;
        });
      }

      function openInitiate(emails, mode = 'single'){
        if (!modal) return;
        currentModalMode = mode === 'group' ? 'group' : 'single';
        currentModalEmails = Array.from(new Set((emails || []).filter(Boolean)));
        setInitiateError('');
        if (initiateCheckr) initiateCheckr.checked = true;
        if (initiateWatch) initiateWatch.checked = true;
        setCheckrTypeEnabled(true);
        if (checkrStandard) checkrStandard.checked = true;
        if (initiateCount) initiateCount.textContent = String(currentModalEmails.length);
        if (initiateModalLabel){
          initiateModalLabel.textContent = currentModalMode === 'group' ? 'Initiate group checks' : 'Initiate checks';
        }
        if (initiateModalDesc){
          initiateModalDesc.textContent = currentModalMode === 'group'
            ? 'Choose Checkr and/or WATCH for the selected students. Only one Checkr type can be initiated.'
            : 'Choose Checkr and/or WATCH. Only one Checkr type can be initiated.';
        }
        if (initiateList){
          const rows = currentModalEmails.map(email => {
            const person = roster.find(p => p.email === email);
            const label = person ? `${person.name} (${person.email})` : email;
            return `<li class="py-1 border-bottom">${label}</li>`;
          });
          initiateList.innerHTML = rows.join('') || '<li class="text-body-secondary">No students selected.</li>';
        }
        modal.show();
      }

      function matchesStatus(person, filter){
        if (!filter) return true;
        const f = String(filter).toLowerCase();
        const checkr = String(person.checkr?.status || '').toLowerCase();
        const watch = String(person.watch?.status || '').toLowerCase();
        if (f === 'na'){
          return !checkr && !watch;
        }
        return checkr === f || watch === f;
      }

      function normalizeSortVal(field, item){
        switch(field){
          case 'checkrModified': return item.checkr?.modified ? new Date(item.checkr.modified).getTime() : 0;
          case 'watchModified': return item.watch?.modified ? new Date(item.watch.modified).getTime() : 0;
          default: return String(item[field] ?? '').toLowerCase();
        }
      }

      function render(){
        if (!tableBody) return;
        const q = (searchInput?.value || '').toLowerCase().trim();
        const program = programSelect?.value || '';
        const cohort = cohortSelect?.value || '';
        const status = statusSelect?.value || '';

        const filtered = roster.filter(p => {
          if (program && p.program !== program) return false;
          if (cohort){
            if (cohort === '__unassigned__'){
              if ((p.cohort || '').trim()) return false;
            }else{
              if (p.cohort !== cohort) return false;
            }
          }
          if (!matchesStatus(p, status)) return false;
          if (q){
            const hay = `${p.name} ${p.email} ${p.program} ${p.cohort}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        filtered.sort((a,b) => {
          const field = sortState.field || 'name';
          const dir = sortState.dir === 'desc' ? -1 : 1;
          const va = normalizeSortVal(field, a);
          const vb = normalizeSortVal(field, b);
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return a.name.localeCompare(b.name);
        });

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page > totalPages) page = totalPages;
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, total);
        const pageItems = filtered.slice(start, end);

        tableBody.innerHTML = '';
        pageItems.forEach(p => {
          const tr = document.createElement('tr');
          const checkrStatus = p.checkr?.status || '';
          const watchStatus = p.watch?.status || '';
          const checkrType = checkrTypeLabel(p.checkr?.type || '');
          tr.innerHTML = `
            <td><input type="checkbox" class="form-check-input bw-row" data-email="${p.email}" ${selectedEmails.has(p.email) ? 'checked' : ''} /></td>
            <td>
              <div class="fw-semibold">${p.name}</div>
              <div class="small text-body-secondary">${p.email}</div>
            </td>
            <td class="d-none d-lg-table-cell">${p.program}</td>
            <td class="d-none d-xl-table-cell">${p.cohort ? p.cohort : '<span class="text-body-secondary">Unassigned</span>'}</td>
            <td>
              <div class="d-flex flex-wrap align-items-center gap-2">
                ${checkrStatus ? `<span class="badge text-bg-secondary">${checkrType || 'Checkr'}</span>` : '<span class="text-body-secondary">—</span>'}
                ${statusBadge(checkrStatus)}
              </div>
            </td>
            <td class="text-nowrap">${prettyDate(p.checkr?.modified || '')}</td>
            <td>
              <div class="d-flex flex-wrap align-items-center gap-2">
                ${statusBadge(watchStatus)}
              </div>
            </td>
            <td class="text-nowrap">${prettyDate(p.watch?.modified || '')}</td>
            <td class="text-end">
              <div class="dropdown">
                <button class="btn btn-outline-secondary btn-sm btn-cpnw dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  Actions
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><button class="dropdown-item" type="button" data-action="initiate" data-email="${p.email}">Initiate…</button></li>
                  <li><button class="dropdown-item" type="button" data-action="clear" data-email="${p.email}">Clear</button></li>
                </ul>
              </div>
            </td>
          `;
          tableBody.appendChild(tr);
        });

        if (selectAll){
          const visibleEmails = pageItems.map(p => p.email);
          const visibleSelected = visibleEmails.filter(e => selectedEmails.has(e)).length;
          selectAll.indeterminate = visibleSelected > 0 && visibleSelected < visibleEmails.length;
          selectAll.checked = !!visibleEmails.length && visibleSelected === visibleEmails.length;
        }

        if (pageInfo){
          pageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = end >= total;

        updateSelectionUI();
      }

      function refreshFromStore(){
        roster.forEach(p => {
          const record = getRecord(p.email);
          p.checkr = record.checkr;
          p.watch = record.watch;
        });
      }

      if (selectAll){
        selectAll.addEventListener('change', () => {
          const boxes = document.querySelectorAll('.bw-row');
          boxes.forEach(cb => {
            cb.checked = selectAll.checked;
            const email = cb.dataset.email;
            if (!email) return;
            if (selectAll.checked) selectedEmails.add(email);
            else selectedEmails.delete(email);
          });
          updateSelectionUI();
        });
      }

      tableBody?.addEventListener('change', (e) => {
        const cb = e.target.closest('input.bw-row');
        if (!cb) return;
        const email = cb.dataset.email;
        if (!email) return;
        if (cb.checked) selectedEmails.add(email);
        else selectedEmails.delete(email);
        updateSelectionUI();
      });

      tableBody?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const email = btn.dataset.email;
        if (!email) return;
        if (action === 'initiate'){
          openInitiate([email], 'single');
        }else if (action === 'clear'){
          if (!window.confirm('Clear Checkr/WATCH status for this student?')) return;
          clearRecord(email);
          refreshFromStore();
          render();
        }
      });

      document.querySelectorAll('.sort').forEach(btn => {
        btn.addEventListener('click', () => {
          const field = btn.dataset.sort;
          if (!field) return;
          if (sortState.field === field){
            sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
          }else{
            sortState.field = field;
            sortState.dir = 'asc';
          }
          render();
        });
      });

      [searchInput, programSelect, cohortSelect, statusSelect].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => { page = 1; render(); });
        if (el.tagName === 'SELECT'){
          el.addEventListener('change', () => { page = 1; render(); });
        }
      });

      pageSizeSelect?.addEventListener('change', () => {
        pageSize = Number(pageSizeSelect.value || 10);
        page = 1;
        render();
      });
      prevBtn?.addEventListener('click', () => { page = Math.max(1, page - 1); render(); });
      nextBtn?.addEventListener('click', () => { page = page + 1; render(); });

      clearFiltersBtn?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (programSelect) programSelect.value = '';
        if (cohortSelect) cohortSelect.value = '';
        if (statusSelect) statusSelect.value = '';
        page = 1;
        render();
      });

      initiateSingleBtn?.addEventListener('click', () => {
        if (selectedEmails.size !== 1) return;
        openInitiate([Array.from(selectedEmails)[0]], 'single');
      });
      initiateGroupBtn?.addEventListener('click', () => {
        if (selectedEmails.size <= 1) return;
        openInitiate(Array.from(selectedEmails), 'group');
      });

      initiateCheckr?.addEventListener('change', () => {
        const enabled = !!initiateCheckr.checked;
        setCheckrTypeEnabled(enabled);
        if (enabled && checkrStandard) checkrStandard.checked = true;
      });

      confirmBtn?.addEventListener('click', () => {
        setInitiateError('');
        const emails = currentModalEmails.slice();
        if (!emails.length){
          setInitiateError('No students selected.');
          return;
        }
        if (currentModalMode === 'group' && emails.length < 2){
          setInitiateError('Group initiation requires at least 2 selected students.');
          return;
        }
        const doCheckr = !!initiateCheckr?.checked;
        const doWatch = !!initiateWatch?.checked;
        if (!doCheckr && !doWatch){
          setInitiateError('Select at least one check to initiate (Checkr and/or WATCH).');
          return;
        }
        const checkrType = doCheckr ? getActiveCheckrType() : '';
        if (doCheckr && !checkrType){
          setInitiateError('Select a Checkr type (Standard or International/Non‑SSN).');
          return;
        }
        const now = isoDate(new Date());
        emails.forEach(email => {
          const patch = {};
          if (doCheckr){
            patch.checkr = { type: checkrType, status: 'sent', modified: now };
          }
          if (doWatch){
            patch.watch = { status: 'sent', modified: now };
          }
          patchRecord(email, patch);
        });
        refreshFromStore();
        render();
        modal?.hide();
      });

      modalEl?.addEventListener('hidden.bs.modal', () => {
        currentModalEmails = [];
        currentModalMode = 'single';
        setInitiateError('');
      });

      render();
    })();
  

