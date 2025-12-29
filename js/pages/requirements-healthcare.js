
    (function(){
      const KEY = 'cpnw-healthcare-requirements-v1';
      const tableBody = document.getElementById('reqTableBody');
      const search = document.getElementById('reqSearch');
      const pageSizeSelect = document.getElementById('reqPageSize');
      const pageInfo = document.getElementById('reqPageInfo');
      const prevBtn = document.getElementById('reqPrev');
      const nextBtn = document.getElementById('reqNext');

      let sortState = { field: 'createdAt', dir: 'desc' };
      let page = 1;
      let pageSize = Number(pageSizeSelect?.value || 10);

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

      function seedIfEmpty(){
        const current = loadJSON(KEY, null);
        if (Array.isArray(current) && current.length) return;
        const now = new Date();
        const iso = (d) => d.toISOString().slice(0, 10);
        const withOffset = (days) => {
          const d = new Date(now);
          d.setDate(d.getDate() - days);
          return iso(d);
        };
        const seeded = [
          {
            id: 'req_parking_map',
            name: 'Parking map',
            abbr: 'PARK',
            requiredBy: 'Healthcare',
            category: 'Site Orientation',
            frequency: 'Once',
            userType: 'Student',
            status: 'Active',
            createdAt: withOffset(180),
            retiredAt: '',
            instructionsHTML: '<p>Review the parking map before your first day at the site.</p>',
            linkedFiles: [{ name: 'ParkingMap.pdf', url: '#' }]
          },
          {
            id: 'req_liability',
            name: 'Liability Insurance',
            abbr: 'LIAB',
            requiredBy: 'Healthcare',
            category: 'Insurance',
            frequency: 'Annually',
            userType: 'Student',
            status: 'Active',
            createdAt: withOffset(120),
            retiredAt: '',
            instructionsHTML: '<p>Upload proof of current liability insurance.</p>',
            linkedFiles: []
          },
          {
            id: 'req_driver_license',
            name: "Driver's License - Color Copy",
            abbr: 'DL',
            requiredBy: 'Healthcare',
            category: 'Forms',
            frequency: 'Once',
            userType: 'Student',
            status: 'Active',
            createdAt: withOffset(90),
            retiredAt: '',
            instructionsHTML: '<p>Upload a color copy of your current driver’s license.</p>',
            linkedFiles: []
          }
        ];
        saveJSON(KEY, seeded);
      }

      function prettyDate(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const date = new Date(val);
        if (Number.isNaN(date.getTime())) return '<span class="text-body-secondary">—</span>';
        return date.toLocaleDateString(undefined, { year:'numeric', month:'2-digit', day:'2-digit' });
      }

      function statusBadge(status){
        const norm = String(status || '').toLowerCase();
        if (norm === 'active') return '<span class="badge text-bg-success">Active</span>';
        if (norm === 'inactive') return '<span class="badge text-bg-secondary">Inactive</span>';
        if (norm === 'retired') return '<span class="badge text-bg-secondary">Retired</span>';
        return `<span class="badge text-bg-secondary">${status || '—'}</span>`;
      }

      function getAll(){
        const list = loadJSON(KEY, []);
        return Array.isArray(list) ? list : [];
      }

      function saveAll(list){
        saveJSON(KEY, list);
      }

      function removeById(id){
        const list = getAll().filter(r => r.id !== id);
        saveAll(list);
      }

      function normalizeSortVal(field, item){
        if (field === 'createdAt' || field === 'retiredAt'){
          return item[field] ? new Date(item[field]).getTime() : 0;
        }
        return String(item[field] ?? '').toLowerCase();
      }

      function render(){
        if (!tableBody) return;
        const q = (search?.value || '').toLowerCase().trim();
        const rows = getAll().filter(r => {
          if (!q) return true;
          const requiredByText = Array.isArray(r.requiredBy) ? r.requiredBy.join(' ') : r.requiredBy;
          const userTypeText = Array.isArray(r.userType) ? r.userType.join(' ') : r.userType;
          const hay = `${r.name} ${r.abbr} ${r.category} ${r.frequency} ${requiredByText} ${userTypeText} ${r.status}`.toLowerCase();
          return hay.includes(q);
        });

        rows.sort((a,b) => {
          const field = sortState.field || 'createdAt';
          const dir = sortState.dir === 'desc' ? -1 : 1;
          const va = normalizeSortVal(field, a);
          const vb = normalizeSortVal(field, b);
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page > totalPages) page = totalPages;
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, total);
        const items = rows.slice(start, end);

        tableBody.innerHTML = '';
        if (!items.length){
          const tr = document.createElement('tr');
          tr.innerHTML = `<td colspan="10" class="text-body-secondary small py-4">No requirements found.</td>`;
          tableBody.appendChild(tr);
        }else{
          items.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>
                <div class="fw-semibold">${r.name || '—'}</div>
                <div class="small text-body-secondary">${r.abbr ? `Abbr: ${r.abbr}` : ''}</div>
              </td>
              <td class="d-none d-md-table-cell">${r.category || '—'}</td>
              <td class="d-none d-lg-table-cell">${r.frequency || '—'}</td>
              <td class="d-none d-xl-table-cell">${Array.isArray(r.requiredBy) ? r.requiredBy.join(', ') : (r.requiredBy || '—')}</td>
              <td class="d-none d-xl-table-cell">${Array.isArray(r.userType) ? r.userType.join(', ') : (r.userType || '—')}</td>
              <td class="text-nowrap">${prettyDate(r.createdAt)}</td>
              <td class="text-nowrap d-none d-lg-table-cell">${prettyDate(r.retiredAt)}</td>
              <td class="text-nowrap">${statusBadge(r.status)}</td>
              <td class="text-end">
                <a class="btn btn-cpnw btn-cpnw-primary btn-sm" href="requirement-builder-healthcare.html?id=${encodeURIComponent(r.id)}">Edit</a>
              </td>
              <td class="text-end">
                <button class="btn btn-danger btn-sm" type="button" data-delete-id="${r.id}">Delete</button>
              </td>
            `;
            tableBody.appendChild(tr);
          });
        }

        if (pageInfo){
          pageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = end >= total;
      }

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

      tableBody?.addEventListener('click', (e) => {
        const del = e.target.closest('button[data-delete-id]');
        if (!del) return;
        const id = del.dataset.deleteId;
        if (!id) return;
        const item = getAll().find(r => r.id === id);
        const label = item?.name || 'this requirement';
        if (!window.confirm(`Delete "${label}"? This cannot be undone in this demo.`)) return;
        removeById(id);
        render();
      });

      search?.addEventListener('input', () => { page = 1; render(); });
      pageSizeSelect?.addEventListener('change', () => {
        pageSize = Number(pageSizeSelect.value || 10);
        page = 1;
        render();
      });
      prevBtn?.addEventListener('click', () => { page = Math.max(1, page - 1); render(); });
      nextBtn?.addEventListener('click', () => { page = page + 1; render(); });

      seedIfEmpty();
      render();
    })();
  
