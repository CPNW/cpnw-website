
    (function(){
      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];
      const currentUser = (() => {
        try{
          return JSON.parse(localStorage.getItem('cpnw-current-user') || 'null');
        }catch(err){
          return null;
        }
      })();
      const canDeleteDocs = !!currentUser?.permissions?.canDelete;
      const currentPrograms = Array.isArray(currentUser?.programs)
        ? currentUser.programs
        : currentUser?.programs ? [currentUser.programs] : [];
      const allowedPrograms = currentPrograms.map(p => String(p || '').toLowerCase());

      function normalizeProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'surg tech';
        if (name.includes('rad')) return 'radiologic technology';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      const programDefs = [
        { id:'BSN', base: 12, aySpan: 2 },
        { id:'ADN', base: 10, aySpan: 2 },
        { id:'Surg Tech', base: 8, aySpan: 2 },
        { id:'Radiologic Technology', base: 6, aySpan: 2 }
      ];
	      const termAdjust = { Fall:3, Winter:1, Spring:0, Summer:-2 };
	      const asISODate = (date) => {
	        const d = date instanceof Date ? date : new Date(date);
	        if (Number.isNaN(d.getTime())) return '';
	        return d.toISOString().slice(0, 10);
	      };
	      const addDays = (days) => {
	        const d = new Date();
	        d.setDate(d.getDate() + days);
	        return d;
	      };
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
      if (allowedPrograms.length){
        cohorts = cohorts.filter(c => allowedPrograms.includes(normalizeProgramLabel(c.program)));
      }

      // Merge custom cohorts + membership deltas (stored in localStorage via main.js)
      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = cohortAPI ? cohortAPI.getMembershipCounts() : {};
	      if (cohortAPI){
	        cohorts = cohorts.map(c => {
	          const delta = membershipCounts[cohortAPI.seedKeyForLabel(c.cohortLabel)] || 0;
	          return { ...c, students: c.students + delta };
	        });
	        const custom = cohortAPI
	          .listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX })
	          .map(c => ({ ...c }));
	        cohorts = cohorts.concat(custom);
	      }

      // Populate cohort filter
      const cohortFilter = document.getElementById('cohortFilter');
      if (cohortFilter){
        const opts = ['', '__unassigned__'];
        cohorts.forEach(c => opts.push(c.cohortLabel));
        const unique = Array.from(new Set(opts));
        cohortFilter.innerHTML = unique.map(val => {
          if (!val) return `<option value="">All cohorts</option>`;
          if (val === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
          return `<option value="${val}">${val}</option>`;
        }).join('');
      }

	      // Build people data
	      const users = [];
	      function applyCohortOverride(user){
        if (!cohortAPI) return user;
        const override = typeof cohortAPI.getUserCohortLabel === 'function'
          ? cohortAPI.getUserCohortLabel(user.email)
          : null;
        if (override !== null && override !== undefined){
          user.cohort = override;
	        }
	        return user;
	      }
	      function computeComplianceStatus(user){
	        const req = user.reqs || {};
	        const hasExpiring = ['cpnw','ed','hc'].some(k => String(req[k] || '').toLowerCase() === 'expiring');
	        if (hasExpiring) return 'expiring';
	        const hasIncomplete = ['cpnw','ed','hc'].some(k => String(req[k] || '').toLowerCase() === 'incomplete');
	        if (hasIncomplete) return 'incomplete';
	        return 'complete';
	      }
	      cohorts.forEach((c, idx) => {
	        const base = Math.min(12, c.students);
	        for (let i=0; i<base; i++){
	          const expiresInDays = (i % 9 === 0) ? (7 + (idx % 24)) : (i % 11 === 0) ? (14 + (idx % 16)) : (i % 13 === 0) ? (22 + (idx % 8)) : null;
	          const expDate = expiresInDays ? asISODate(addDays(expiresInDays)) : '';
	          // OIG/SAM are run bi-monthly (1st/15th). Newer students may be blank; most results are Pass.
	          let oig = 'pass';
	          let sam = 'pass';
	          const screenSeed = (idx * 97 + i * 131) % 1000; // stable demo distribution
	          if (screenSeed < 80){
	            oig = '';
	            sam = '';
	          }else if (screenSeed === 999){
	            oig = 'fail';
	            sam = 'pass';
	          }
	          const person = {
	            name: `Student ${idx+1}-${i+1}`,
	            email: `student${idx+1}${i+1}@demo.cpnw.org`,
	            program: c.program,
	            cohort: c.cohortLabel,
	            role: 'student',
	            reqs: {
	              cpnw: (i % 3) ? 'complete' : 'incomplete',
	              ed: (i % 4) ? 'complete' : 'incomplete',
	              hc: (i % 5) ? 'complete' : 'incomplete',
	              oig,
	              sam
	            },
	            reqMeta: {
	              expiringAt: expDate,
	              expiringDays: expiresInDays
	            },
	            docs: Math.max(1, (i % 4)),
	            docItems: [
	              { file:'Immunization.pdf', req:'Immunization', date:'2025-02-10' },
	              { file:'BLS.pdf', req:'BLS', date:'2025-02-08' }
	            ]
	          };
	          // Add some realistic "Expiring" records (expiring within 30 days).
	          if (expiresInDays && expiresInDays <= 30){
	            if (i % 9 === 0) person.reqs.cpnw = 'expiring';
	            else if (i % 11 === 0) person.reqs.ed = 'expiring';
	            else if (i % 13 === 0) person.reqs.hc = 'expiring';
	          }
	          person.status = computeComplianceStatus(person);
	          users.push(applyCohortOverride(person));
	        }
	        // Add a few faculty and faculty-admin tied to this program
	        users.push(applyCohortOverride({
	          name: `Faculty ${c.program} ${idx+1}`,
	          email: `faculty${idx+1}@demo.cpnw.org`,
	          program: c.program,
	          cohort: c.cohortLabel,
	          role: 'faculty',
	          reqs: {
	            cpnw: 'complete',
	            ed: 'complete',
	            hc: 'complete',
	            oig: 'pass',
	            sam: 'pass'
	          },
	          docs: 1,
	          docItems: [{ file:'FacultyCert.pdf', req:'Faculty Credential', date:'2025-02-12' }]
	        }));
	        users.push(applyCohortOverride({
	          name: `Faculty Admin ${c.program} ${idx+1}`,
	          email: `facadmin${idx+1}@demo.cpnw.org`,
	          program: c.program,
	          cohort: c.cohortLabel,
	          role: 'faculty-admin',
	          reqs: {
	            cpnw: 'complete',
	            ed: 'complete',
	            hc: 'complete',
	            oig: (idx % 2) ? 'pass' : 'fail',
	            sam: (idx % 3) ? 'pass' : 'fail'
	          },
	          docs: 1,
	          docItems: [{ file:'AdminAccess.pdf', req:'Admin Approval', date:'2025-02-11' }]
	        }));
	      });
	      // Ensure any non-student rows still get a computed compliance status.
	      users.forEach(u => { u.status = u.status || computeComplianceStatus(u); });
      users.push(applyCohortOverride({
        name: 'Fran Faculty',
        email: 'fran.faculty@cpnw.org',
        program: 'BSN',
        cohort: '',
        role: 'faculty',
	        reqs: {
	          cpnw: 'complete',
	          ed: 'complete',
	          hc: 'complete',
          oig: 'pass',
          sam: 'pass'
        },
        docs: 1,
        docItems: [{ file:'FacultyCert.pdf', req:'Faculty Credential', date:'2025-02-12' }]
      }));

      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];
      function normalizeProgramDisplay(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return label || 'BSN';
      }
      demoPeople.forEach(person => {
        if (!['student', 'faculty'].includes(person.role)) return;
        const exists = users.some(u => u.email.toLowerCase() === person.email.toLowerCase());
        if (exists) return;
        const record = applyCohortOverride({
          name: person.name,
          email: person.email,
          program: normalizeProgramDisplay(person.programs?.[0]),
          cohort: person.cohort || '',
          role: person.role,
          reqs: person.reqs || { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
          docs: person.docItems ? person.docItems.length : 0,
          docItems: person.docItems || []
        });
        record.status = computeComplianceStatus(record);
        users.push(record);
      });

      if (allowedPrograms.length){
        const allowedSet = new Set(allowedPrograms.map(normalizeProgramLabel));
        for (let i = users.length - 1; i >= 0; i--){
          const programKey = normalizeProgramLabel(users[i].program);
          if (!allowedSet.has(programKey)){
            users.splice(i, 1);
          }
        }
      }

      const statusButtons = document.querySelectorAll('[data-status]');
      const reportSearch = document.getElementById('reportSearch');
      const locationFilter = document.getElementById('locationFilter'); // placeholder, not applied to sample data
      const programFilterSelect = document.getElementById('programFilter');
      const reportTableBody = document.getElementById('reportTableBody');
      const selectAllReports = document.getElementById('selectAllReports');
      const showSelectedBtn = document.getElementById('showSelected');
      const exportBtn = document.getElementById('exportBtn');
      const reportPageSizeSelect = document.getElementById('reportPageSize');
      const reportPrevPage = document.getElementById('reportPrevPage');
      const reportNextPage = document.getElementById('reportNextPage');
      const reportPageInfo = document.getElementById('reportPageInfo');
      const reqModalBody = document.getElementById('reqModalBody');
      const reqModalLabel = document.getElementById('reqModalLabel');
      const reqModalSub = document.getElementById('reqModalSub');
      let currentStatus = 'all';
      let reportPage = 1;
      let reportPageSize = Number(reportPageSizeSelect?.value || 10);
      const selectedIds = new Set();

      function statusBadge(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const normalized = val.toLowerCase();
        let cls = 'text-bg-secondary';
        if (normalized === 'complete' || normalized === 'pass') cls = 'text-bg-success';
        else if (normalized === 'expiring') cls = 'text-bg-warning text-dark';
        else cls = 'text-bg-danger';
        const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        return `<span class="badge ${cls}">${label}</span>`;
      }

      const reqCounts = { cpnw:20, ed:4, hc:6 };
      const reqLabels = { cpnw:'CPNW', ed:'Education', hc:'Healthcare' };

	      function buildReqList(type, overallStatus){
	        const total = reqCounts[type] || 0;
	        const list = [];
	        for (let i=1;i<=total;i++){
	          let itemStatus = 'complete';
	          if (overallStatus === 'expiring'){
	            itemStatus = (i % 5 === 0) ? 'expiring' : 'complete';
	          }else if (overallStatus !== 'complete'){
	            itemStatus = (i % 4 === 0) ? 'incomplete' : 'complete';
	          }
	          list.push({ name: `${reqLabels[type] || type.toUpperCase()} Req ${i}`, status: itemStatus });
	        }
	        return list;
	      }

      function renderReports(showOnlySelected = false){
        const q = (reportSearch?.value || '').toLowerCase();
        const program = programFilterSelect?.value || '';
        const cohort = cohortFilter?.value || '';
	        const filtered = users.filter(u=>{
	          if (currentStatus !== 'all' && u.status !== currentStatus) return false;
	          if (program && u.program !== program) return false;
          if (cohort){
            if (cohort === '__unassigned__'){
              if ((u.cohort || '').trim()) return false;
            }else{
              if (u.cohort !== cohort) return false;
            }
          }
          if (showOnlySelected && !selectedIds.has(u.email)) return false;
          if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
          return true;
        });
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / reportPageSize));
        if (reportPage > totalPages) reportPage = totalPages;
        const start = (reportPage - 1) * reportPageSize;
        const end = Math.min(start + reportPageSize, total);
        const pageItems = filtered.slice(start, end);

	        reportTableBody.innerHTML = '';
	        pageItems.forEach(u=>{
	          const tr = document.createElement('tr');
	          tr.innerHTML = `
	            <td><input type="checkbox" class="form-check-input report-row" data-id="${u.email}" ${selectedIds.has(u.email) ? 'checked' : ''}></td>
	            <td class="fw-semibold">${u.name}</td>
	            <td>${u.program}</td>
	            <td>${u.cohort ? u.cohort : '<span class="text-body-secondary">Unassigned</span>'}</td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="cpnw" data-user="${u.email}">${statusBadge(u.reqs?.cpnw)}</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="ed" data-user="${u.email}">${statusBadge(u.reqs?.ed)}</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="hc" data-user="${u.email}">${statusBadge(u.reqs?.hc)}</button></td>
	            <td>${statusBadge(u.reqs?.oig)}</td>
	            <td>${statusBadge(u.reqs?.sam)}</td>
	            <td><button class="btn btn-outline-secondary btn-sm" data-docs="${u.name}">Open</button></td>
	          `;
	          reportTableBody.appendChild(tr);
	        });

        if (reportPageInfo){
          reportPageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (reportPrevPage && reportNextPage){
          reportPrevPage.disabled = reportPage <= 1;
          reportNextPage.disabled = end >= total;
        }
      }

      statusButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          statusButtons.forEach(b=>{
            b.classList.remove('btn-cpnw','btn-cpnw-primary');
            b.classList.add('btn-outline-secondary');
          });
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
          currentStatus = btn.dataset.status;
          reportPage = 1;
          renderReports();
        });
      });

      [reportSearch, programFilterSelect, cohortFilter].forEach(el=>{
        if (el){
          el.addEventListener('input', () => { reportPage = 1; renderReports(); });
          if (el.tagName === 'SELECT') el.addEventListener('change', () => { reportPage = 1; renderReports(); });
        }
      });

      if (reportPageSizeSelect){
        reportPageSizeSelect.addEventListener('change', () => {
          reportPageSize = Number(reportPageSizeSelect.value || 10);
          reportPage = 1;
          renderReports();
        });
      }
      if (reportPrevPage){
        reportPrevPage.addEventListener('click', () => {
          if (reportPage > 1){
            reportPage -= 1;
            renderReports();
          }
        });
      }
      if (reportNextPage){
        reportNextPage.addEventListener('click', () => {
          reportPage += 1;
          renderReports();
        });
      }

      document.addEventListener('click', (e)=>{
        if (e.target.matches('.report-row')){
          const id = e.target.dataset.id;
          if (id){
            if (e.target.checked){ selectedIds.add(id); }
            else{ selectedIds.delete(id); }
          }
        }

        const reqBtn = e.target.closest('.req-cell');
        if (reqBtn){
          const type = reqBtn.dataset.reqType;
          const userId = reqBtn.dataset.user;
          const person = users.find(u=>u.email === userId);
          if (person && reqCounts[type]){
            const list = buildReqList(type, person.reqs?.[type]);
            reqModalLabel.textContent = `${reqLabels[type] || type.toUpperCase()} requirements`;
            reqModalSub.textContent = person.name;
            reqModalBody.innerHTML = list.map(item=>`
              <tr>
                <td>${item.name}</td>
                <td>${statusBadge(item.status)}</td>
              </tr>
            `).join('');
            const modal = new bootstrap.Modal(document.getElementById('reqModal'));
            modal.show();
          }
        }

        const btn = e.target.closest('[data-docs]');
        if (!btn) return;
        const name = btn.dataset.docs;
        const person = users.find(u=>u.name === name);
        if (!person) return;
        const tbody = document.getElementById('docsTableBody');
        const permissionAlert = document.querySelector('[data-docs-permission]');
        const removeHeader = document.getElementById('docsRemoveHeader');
        if (permissionAlert){
          permissionAlert.classList.toggle('d-none', canDeleteDocs);
        }
        if (removeHeader){
          removeHeader.textContent = canDeleteDocs ? 'Remove' : 'Remove (no access)';
        }
        tbody.innerHTML = (person.docItems || []).map(d=>`
          <tr>
            <td><input type="checkbox" class="form-check-input"></td>
            <td>${d.file}</td>
            <td>${d.req}</td>
            <td>${d.date}</td>
            <td class="text-end">
              <button
                class="btn btn-link ${canDeleteDocs ? 'text-danger' : 'text-body-secondary'} p-0"
                type="button"
                ${canDeleteDocs ? '' : 'disabled aria-disabled="true"'}
              >
                ${canDeleteDocs ? '🗑' : '🔒'}
              </button>
            </td>
          </tr>
        `).join('');
        const modal = new bootstrap.Modal(document.getElementById('docsModal'));
        modal.show();
      });

      if (selectAllReports){
        selectAllReports.addEventListener('change', () => {
          const check = selectAllReports.checked;
          document.querySelectorAll('.report-row').forEach(cb => {
            cb.checked = check;
            const id = cb.dataset.id;
            if (id){
              if (check) selectedIds.add(id);
              else selectedIds.delete(id);
            }
          });
        });
      }

      showSelectedBtn?.addEventListener('click', () => {
        renderReports(true);
      });

      exportBtn?.addEventListener('click', () => {
        alert(`Exporting ${selectedIds.size} selected records (demo).`);
      });

      renderReports();
    })();
  

