
    (function(){
      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];

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
              students,
              start: `${term} ${year}`
            });
          });
        });
      });
      let cohorts = cohortSeeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);

      // Merge custom cohorts + membership deltas (stored in localStorage via main.js)
      const cohortAPI = window.CPNW && window.CPNW.cohorts ? window.CPNW.cohorts : null;
      const membershipCounts = cohortAPI ? cohortAPI.getMembershipCounts() : {};
      if (cohortAPI){
        cohorts = cohorts.map(c => {
          const delta = membershipCounts[cohortAPI.seedKeyForLabel(c.cohortLabel)] || 0;
          return { ...c, students: c.students + delta };
        });
        const custom = cohortAPI.listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX });
        cohorts = cohorts.concat(custom);
      }

      // populate cohort filter
      const cohortFilter = document.getElementById('cohortFilter');
      if (cohortFilter){
        const opts = ['', '__unassigned__'];
        cohorts.forEach(c => opts.push(c.cohortLabel));
        const unique = Array.from(new Set(opts));
        cohortFilter.innerHTML = unique.map(v => {
          if (!v) return `<option value="">All cohorts</option>`;
          if (v === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
          return `<option value="${v}">${v}</option>`;
        }).join('');
      }

      const programFilter = document.getElementById('programFilter');
      const siteFilter = document.getElementById('siteFilter');
      const assignmentSearch = document.getElementById('assignmentSearch');
      const assignmentTableBody = document.getElementById('assignmentTableBody');
      const assignmentPageSizeSelect = document.getElementById('assignmentPageSize');
      const assignmentPrevPage = document.getElementById('assignmentPrevPage');
      const assignmentNextPage = document.getElementById('assignmentNextPage');
      const assignmentPageInfo = document.getElementById('assignmentPageInfo');
      const selectAllAssignments = document.getElementById('selectAllAssignments');
      const statusButtons = document.querySelectorAll('[data-filter-status]');
      const showSelectedBtn = document.getElementById('showSelected');
      const exportBtn = document.getElementById('exportAssignments');
      const assignGroupBtn = document.getElementById('assignGroupBtn');
      const editGroupBtn = document.getElementById('editGroupBtn');
      const rangeButtons = document.querySelectorAll('[data-range]');
      const sortButtons = document.querySelectorAll('.sort');
      const groupModalEl = document.getElementById('groupAssignmentModal');
      const groupModal = groupModalEl ? new bootstrap.Modal(groupModalEl) : null;
      const groupModalLabel = document.getElementById('groupAssignmentModalLabel');
      const groupModalSub = document.getElementById('groupAssignmentModalSub');
      const groupLocation = document.getElementById('groupAssignLocation');
      const groupStart = document.getElementById('groupAssignStart');
      const groupEnd = document.getElementById('groupAssignEnd');
      const groupError = document.getElementById('groupAssignError');
      const groupSave = document.getElementById('groupAssignSave');

      const locations = ['CPNW Medical Center','CPNW Healthcare Facility','Evergreen Health','Providence NW'];
      const statusPool = ['approved','pending','rejected'];
      const students = [];
      const assignments = [];
      cohorts.forEach((c, idx) => {
        const count = Math.min(10, c.students);
        for (let i=0;i<count;i++){
          const studentId = `${idx+1}-${i+1}`;
          const student = {
            id: studentId,
            name: `Student ${studentId}`,
            sid: String(1000 + idx * 50 + i),
            email: `student${idx+1}${i+1}@demo.cpnw.org`,
            role: 'Student',
            program: c.program,
            cohort: c.cohortLabel,
          };
          if (cohortAPI){
            const override = typeof cohortAPI.getUserCohortLabel === 'function'
              ? cohortAPI.getUserCohortLabel(student.email)
              : null;
            if (override !== null && override !== undefined){
              student.cohort = override;
            }
          }
          students.push(student);

          // Some students have no current/upcoming assignment (wireframe demo)
          const hasCurrentUpcoming = ((idx + i) % 5) !== 0;
          const hasPast = ((idx + i) % 3) !== 0;

          if (hasPast){
            const startPast = new Date(TODAY);
            startPast.setDate(startPast.getDate() - (120 + idx * 3 + i));
            const endPast = new Date(startPast);
            endPast.setDate(endPast.getDate() + 60);
            assignments.push({
              id: `a-past-${studentId}`,
              studentId,
              location: locations[(i + idx) % locations.length],
              start: startPast,
              end: endPast,
              status: statusPool[(i + idx + 1) % statusPool.length]
            });
          }

          if (hasCurrentUpcoming){
            const start = new Date(TODAY);
            start.setDate(start.getDate() + (idx * 8) + i * 2);
            const end = new Date(start);
            end.setDate(end.getDate() + 90);
            assignments.push({
              id: `a-cur-${studentId}`,
              studentId,
              location: locations[(i + idx + 2) % locations.length],
              start,
              end,
              status: statusPool[(i + idx) % statusPool.length]
            });
          }
        }
      });

      const locationAddOptions = ['CPNW Medical Center','CPNW Healthcare Facility'];

      let currentStatus = 'all';
      let currentRange = 'current'; // 'current' | 'past'
      let assignmentPage = 1;
      let assignmentPageSize = Number(assignmentPageSizeSelect?.value || 10);
      let sortState = { field:'', dir:'asc' };
      const selectedIds = new Set();
      let addDraft = null; // { replaceRowId?: string, afterRowId?: string, studentId: string }
      let editDraft = null; // { rowId: string, assignmentId: string }
      let groupMode = 'assign';
      let groupSelection = [];

      function getSortToken(row, field){
        const student = row.student;
        const assignment = row.assignment;
        if (field === 'start' || field === 'end'){
          const d = assignment?.[field];
          if (!(d instanceof Date)) return { blank:true, type:'number', value: 0 };
          return { blank:false, type:'number', value: d.getTime() };
        }
        let raw;
        if (field === 'location' || field === 'status'){
          raw = assignment?.[field] ?? '';
        }else{
          raw = student?.[field] ?? '';
        }
        const str = String(raw ?? '').trim();
        if (!str) return { blank:true, type:'string', value: '' };
        return { blank:false, type:'string', value: str };
      }

      function statusBadge(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const normalized = val.toLowerCase();
        const map = {
          approved: 'text-bg-success',
          pending: 'text-bg-secondary',
          rejected: 'text-bg-danger'
        };
        const cls = map[normalized] || 'text-bg-secondary';
        const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        return `<span class="badge ${cls}">${label}</span>`;
      }

      function isPast(a){
        return a?.end instanceof Date && a.end < TODAY;
      }

      function isCurrentUpcoming(a){
        return a?.end instanceof Date && a.end >= TODAY;
      }

      function listCurrentUpcoming(studentId){
        return assignments
          .filter(a=>a.studentId === studentId && isCurrentUpcoming(a))
          .sort((a,b)=>a.start - b.start);
      }

      function listPast(studentId){
        return assignments
          .filter(a=>a.studentId === studentId && isPast(a))
          .sort((a,b)=>b.end - a.end);
      }

      function fmtDate(d){
        if (!(d instanceof Date)) return '';
        return d.toLocaleDateString();
      }

      function fmtDateInput(d){
        if (!(d instanceof Date)) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const dd = String(d.getDate()).padStart(2,'0');
        return `${yyyy}-${mm}-${dd}`;
      }

      function setGroupError(message){
        if (!groupError) return;
        if (!message){
          groupError.classList.add('d-none');
          groupError.textContent = '';
          return;
        }
        groupError.classList.remove('d-none');
        groupError.textContent = message;
      }

      function getSelectionDetails(){
        const details = [];
        selectedIds.forEach(id=>{
          if (!id) return;
          let studentId = '';
          let assignment = null;
          if (id.startsWith('placeholder-')){
            studentId = id.replace('placeholder-','');
          }else{
            assignment = assignments.find(a=>a.id === id) || null;
            studentId = assignment?.studentId || '';
          }
          const student = students.find(s=>s.id === studentId) || null;
          if (student){
            details.push({ rowId: id, student, assignment });
          }
        });
        return details;
      }

      function openGroupModal(mode){
        if (!groupModal) return;
        groupMode = mode;
        groupSelection = getSelectionDetails();
        if (!groupSelection.length){
          alert('Select at least one student.');
          return;
        }
        setGroupError('');
        if (groupModalLabel){
          groupModalLabel.textContent = mode === 'edit' ? 'Edit group assignment' : 'Assign group';
        }
        if (groupModalSub){
          groupModalSub.textContent = `${groupSelection.length} selected`;
        }
        if (groupLocation){
          const opts = Array.from(new Set([...locationAddOptions, ...locations])).sort();
          groupLocation.innerHTML = ['<option value="">Select location</option>', ...opts.map(l=>`<option value="${l}">${l}</option>`)].join('');
        }
        if (groupStart) groupStart.value = '';
        if (groupEnd) groupEnd.value = '';

        if (mode === 'edit'){
          const assignmentsOnly = groupSelection.filter(item => item.assignment);
          if (assignmentsOnly.length !== groupSelection.length){
            alert('Edit group only applies to students with existing assignments.');
            return;
          }
          const startVal = fmtDateInput(assignmentsOnly[0].assignment.start);
          const endVal = fmtDateInput(assignmentsOnly[0].assignment.end);
          const sameDates = assignmentsOnly.every(item => fmtDateInput(item.assignment.start) === startVal && fmtDateInput(item.assignment.end) === endVal);
          if (!sameDates){
            alert('Edit group only works when all selected students share the same start/end dates.');
            return;
          }
          if (groupStart) groupStart.value = startVal;
          if (groupEnd) groupEnd.value = endVal;
        }
        groupModal.show();
      }

      function renderAssignments(showOnlySelected = false){
        const q = (assignmentSearch?.value || '').toLowerCase();
        const program = programFilter?.value || '';
        const cohortVal = cohortFilter?.value || '';
        const siteVal = siteFilter?.value || '';
        const rows = [];
        students.forEach(s=>{
          if (program && s.program !== program) return;
          if (cohortVal){
            if (cohortVal === '__unassigned__'){
              if ((s.cohort || '').trim()) return;
            }else{
              if (s.cohort !== cohortVal) return;
            }
          }
          if (q && !`${s.name} ${s.sid} ${s.email}`.toLowerCase().includes(q)) return;

          const list = currentRange === 'past' ? listPast(s.id) : listCurrentUpcoming(s.id);

          if (currentRange === 'past'){
            if (!list.length) return;
            list.forEach(a=>{
              if (currentStatus !== 'all' && a.status !== currentStatus) return;
              if (siteVal && (a.location || '') !== siteVal) return;
              if (showOnlySelected && !selectedIds.has(a.id)) return;
              rows.push({ rowId: a.id, student: s, assignment: a, kind: 'assignment' });
            });
            return;
          }

          if (!list.length){
            if (currentStatus !== 'all') return;
            if (siteVal) return;
            const rowId = `placeholder-${s.id}`;
            if (showOnlySelected && !selectedIds.has(rowId)) return;
            rows.push({ rowId, student: s, assignment: null, kind: 'placeholder' });
            return;
          }

          list.forEach(a=>{
            if (currentStatus !== 'all' && a.status !== currentStatus) return;
            if (siteVal && (a.location || '') !== siteVal) return;
            if (showOnlySelected && !selectedIds.has(a.id)) return;
            rows.push({ rowId: a.id, student: s, assignment: a, kind: 'assignment' });
          });
        });

        if (sortState.field){
          const field = sortState.field;
          const dir = sortState.dir === 'desc' ? -1 : 1;
          rows.sort((a,b)=>{
            const tokenA = getSortToken(a, field);
            const tokenB = getSortToken(b, field);
            if (tokenA.blank !== tokenB.blank) return tokenA.blank ? 1 : -1;

            let cmp = 0;
            if (tokenA.type === 'number' && tokenB.type === 'number'){
              cmp = tokenA.value - tokenB.value;
            }else{
              const valA = String(tokenA.value ?? '').toLowerCase();
              const valB = String(tokenB.value ?? '').toLowerCase();
              cmp = valA.localeCompare(valB, undefined, { numeric:true, sensitivity:'base' });
            }
            if (cmp) return cmp * dir;

            const nameCmp = (a.student?.name || '').localeCompare((b.student?.name || ''), undefined, { sensitivity:'base' });
            if (nameCmp) return nameCmp;
            const sidCmp = String(a.student?.sid || '').localeCompare(String(b.student?.sid || ''), undefined, { numeric:true, sensitivity:'base' });
            if (sidCmp) return sidCmp;
            return String(a.rowId || '').localeCompare(String(b.rowId || ''));
          });
        }

        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / assignmentPageSize));
        if (assignmentPage > totalPages) assignmentPage = totalPages;
        const startIdx = (assignmentPage - 1) * assignmentPageSize;
        const endIdx = Math.min(startIdx + assignmentPageSize, total);
        let pageItems = rows.slice(startIdx, endIdx);

        const insertEditorAfter = (afterRowId, studentId) => {
          const index = pageItems.findIndex(r => r.rowId === afterRowId);
          if (index === -1) return false;
          pageItems.splice(index + 1, 0, {
            rowId: `editor-after-${afterRowId}`,
            student: students.find(s=>s.id === studentId),
            assignment: null,
            kind: 'editor-add'
          });
          if (pageItems.length > assignmentPageSize){
            const protectedIds = new Set([afterRowId, `editor-after-${afterRowId}`]);
            for (let i = pageItems.length - 1; i >= 0; i--){
              if (!protectedIds.has(pageItems[i].rowId)){
                pageItems.splice(i, 1);
                break;
              }
            }
          }
          return true;
        };

        if (editDraft && !pageItems.some(r=>r.rowId === editDraft.rowId)) editDraft = null;
        if (addDraft){
          if (addDraft.replaceRowId && !pageItems.some(r=>r.rowId === addDraft.replaceRowId)) addDraft = null;
          if (addDraft.afterRowId){
            const ok = insertEditorAfter(addDraft.afterRowId, addDraft.studentId);
            if (!ok) addDraft = null;
          }
        }

        assignmentTableBody.innerHTML = '';
        pageItems.forEach(({ rowId, student, assignment, kind })=>{
          const tr = document.createElement('tr');
          tr.dataset.rowId = rowId;
          tr.dataset.studentId = student.id;
          const isPlaceholder = kind === 'placeholder';
          const isEditor = kind === 'editor-add';
          const isAddReplace = addDraft?.replaceRowId === rowId;
          const isAddEditor = kind === 'editor-add';
          const isAdding = currentRange === 'current' && (isAddReplace || isAddEditor);
          const isEditing = editDraft?.rowId === rowId;
          const startStr = fmtDate(assignment?.start);
          const endStr = fmtDate(assignment?.end);
          const statusCell = (isPlaceholder || isEditor)
            ? '<span class="text-body-secondary">—</span>'
            : statusBadge(assignment.status);

          const actionCell = (function(){
            if (isAdding){
              return `
                <div class="d-flex justify-content-end gap-1">
                  <button class="btn btn-sm btn-outline-secondary" type="button" title="Cancel" data-action="cancel-add">✕</button>
                  <button class="btn btn-sm btn-cpnw btn-cpnw-primary" type="button" title="Save" data-action="save-add">💾</button>
                </div>
              `;
            }
            if (isEditing){
              return `
                <div class="d-flex justify-content-end gap-1">
                  <button class="btn btn-sm btn-outline-secondary" type="button" title="Cancel" data-action="cancel-edit">✕</button>
                  <button class="btn btn-sm btn-cpnw btn-cpnw-primary" type="button" title="Save" data-action="save-edit">💾</button>
                </div>
              `;
            }
            if (isPlaceholder){
              return `
                <div class="d-flex justify-content-end gap-1">
                  <button class="btn btn-sm btn-outline-secondary" type="button" title="Add assignment" data-action="add-replace" data-row="${rowId}" data-student="${student.id}">＋</button>
                </div>
              `;
            }
            return `
              <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-outline-secondary" type="button" title="Add assignment" data-action="add-after" data-row="${rowId}" data-student="${student.id}">＋</button>
                <button class="btn btn-sm btn-outline-secondary" type="button" title="Edit assignment" data-action="edit" data-row="${rowId}" data-assignment="${assignment?.id || ''}">✎</button>
                <button class="btn btn-sm btn-outline-danger" type="button" title="Remove" data-action="delete" data-assignment="${assignment?.id || ''}">🗑</button>
              </div>
            `;
          })();

          const locationCell = (function(){
            if (isAdding){
              return `
                <select class="form-select form-select-sm" data-field="location">
                  <option value="">Select location</option>
                  ${locationAddOptions.map(l=>`<option value="${l}">${l}</option>`).join('')}
                </select>
              `;
            }
            if (isEditing){
              const opts = Array.from(new Set([...locationAddOptions, ...locations, assignment?.location].filter(Boolean)));
              return `
                <select class="form-select form-select-sm" data-field="location">
                  ${opts.map(l=>`<option value="${l}" ${l===assignment?.location?'selected':''}>${l}</option>`).join('')}
                </select>
              `;
            }
            return assignment?.location || '<span class="text-body-secondary">—</span>';
          })();

          const startCell = (isAdding || isEditing)
            ? `<input type="date" class="form-control form-control-sm" data-field="start" value="${isEditing ? fmtDateInput(assignment?.start) : ''}" />`
            : (startStr || '<span class="text-body-secondary">—</span>');
          const endCell = (isAdding || isEditing)
            ? `<input type="date" class="form-control form-control-sm" data-field="end" value="${isEditing ? fmtDateInput(assignment?.end) : ''}" />`
            : (endStr || '<span class="text-body-secondary">—</span>');

          const checkboxCell = isEditor
            ? ''
            : `<input class="form-check-input assignment-row" type="checkbox" data-id="${rowId}" ${selectedIds.has(rowId) ? 'checked' : ''}>`;

          tr.innerHTML = `
            <td>${checkboxCell}</td>
            <td class="fw-semibold">${student.name}</td>
            <td>${student.sid}</td>
            <td>${student.role}</td>
            <td>${student.program}</td>
            <td>${student.cohort}</td>
            <td>${locationCell}</td>
            <td>${startCell}</td>
            <td>${endCell}</td>
            <td>${statusCell}</td>
            <td class="text-end">${actionCell}</td>
          `;
          assignmentTableBody.appendChild(tr);
        });

        if (assignmentPageInfo){
          assignmentPageInfo.textContent = total ? `Showing ${startIdx + 1}–${endIdx} of ${total}` : 'No results';
        }
        if (assignmentPrevPage && assignmentNextPage){
          assignmentPrevPage.disabled = assignmentPage <= 1;
          assignmentNextPage.disabled = endIdx >= total;
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
          currentStatus = btn.dataset.filterStatus;
          assignmentPage = 1;
          addDraft = null;
          editDraft = null;
          renderAssignments();
        });
      });

      [assignmentSearch, programFilter, cohortFilter, siteFilter].forEach(el=>{
        if (!el) return;
        const fn = () => { assignmentPage = 1; renderAssignments(); };
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', fn);
      });

      rangeButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          rangeButtons.forEach(b=>{
            b.classList.remove('btn-cpnw','btn-cpnw-primary');
            b.classList.add('btn-outline-secondary');
          });
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
          currentRange = btn.dataset.range;
          assignmentPage = 1;
          addDraft = null;
          editDraft = null;
          renderAssignments();
        });
      });

      sortButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const field = btn.dataset.sort;
          if (!field) return;
          if (sortState.field === field){
            sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
          }else{
            sortState = { field, dir:'asc' };
          }
          assignmentPage = 1;
          addDraft = null;
          editDraft = null;
          renderAssignments();
        });
      });

      if (assignmentPageSizeSelect){
        assignmentPageSizeSelect.addEventListener('change', ()=>{
          assignmentPageSize = Number(assignmentPageSizeSelect.value || 10);
          assignmentPage = 1;
          renderAssignments();
        });
      }

      assignmentPrevPage?.addEventListener('click', ()=>{
        if (assignmentPage > 1){
          assignmentPage -= 1;
          renderAssignments();
        }
      });
      assignmentNextPage?.addEventListener('click', ()=>{
        assignmentPage += 1;
        renderAssignments();
      });

      document.addEventListener('click', (e)=>{
        if (e.target.matches('.assignment-row')){
          const id = e.target.dataset.id;
          if (id){
            if (e.target.checked) selectedIds.add(id);
            else selectedIds.delete(id);
          }
        }

        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn){
          const action = actionBtn.dataset.action;
          if (action === 'add-replace'){
            if (currentRange !== 'current') return;
            const rowId = actionBtn.dataset.row;
            const studentId = actionBtn.dataset.student;
            if (!rowId || !studentId) return;
            addDraft = { replaceRowId: rowId, studentId };
            editDraft = null;
            renderAssignments();
          }

          if (action === 'add-after'){
            if (currentRange !== 'current') return;
            const rowId = actionBtn.dataset.row;
            const studentId = actionBtn.dataset.student;
            if (!rowId || !studentId) return;
            addDraft = { afterRowId: rowId, studentId };
            editDraft = null;
            renderAssignments();
          }

          if (action === 'edit'){
            const rowId = actionBtn.dataset.row;
            const assignmentId = actionBtn.dataset.assignment;
            if (!rowId || !assignmentId) return;
            editDraft = { rowId, assignmentId };
            addDraft = null;
            renderAssignments();
          }

          if (action === 'delete'){
            const assignmentId = actionBtn.dataset.assignment;
            if (!assignmentId) return;
            const ok = confirm('Remove this assignment?');
            if (!ok) return;
            const idx = assignments.findIndex(a=>a.id === assignmentId);
            if (idx !== -1) assignments.splice(idx, 1);
            if (editDraft?.assignmentId === assignmentId) editDraft = null;
            renderAssignments();
          }

          if (action === 'cancel-add'){
            addDraft = null;
            renderAssignments();
          }

          if (action === 'cancel-edit'){
            editDraft = null;
            renderAssignments();
          }

          if (action === 'save-add'){
            const row = actionBtn.closest('tr');
            const loc = row?.querySelector('[data-field="location"]')?.value || '';
            const startVal = row?.querySelector('[data-field="start"]')?.value || '';
            const endVal = row?.querySelector('[data-field="end"]')?.value || '';
            if (!loc || !startVal || !endVal){
              alert('Please choose a location and enter both start and end dates.');
              return;
            }
            const start = new Date(`${startVal}T00:00:00`);
            const end = new Date(`${endVal}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start){
              alert('Please enter a valid date range (end date must be on/after start date).');
              return;
            }
            const studentId = row?.dataset.studentId;
            if (!studentId){
              alert('Unable to save: missing student id.');
              return;
            }
            const id = `a-added-${studentId}-${Date.now()}`;
            assignments.push({ id, studentId, location: loc, start, end, status: 'pending' });
            addDraft = null;
            renderAssignments();
          }

          if (action === 'save-edit'){
            const row = actionBtn.closest('tr');
            const loc = row?.querySelector('[data-field="location"]')?.value || '';
            const startVal = row?.querySelector('[data-field="start"]')?.value || '';
            const endVal = row?.querySelector('[data-field="end"]')?.value || '';
            if (!loc || !startVal || !endVal){
              alert('Please choose a location and enter both start and end dates.');
              return;
            }
            const start = new Date(`${startVal}T00:00:00`);
            const end = new Date(`${endVal}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start){
              alert('Please enter a valid date range (end date must be on/after start date).');
              return;
            }
            const assignmentId = editDraft?.assignmentId;
            const a = assignments.find(x=>x.id === assignmentId);
            if (!a){
              alert('Unable to save: assignment not found.');
              return;
            }
            a.location = loc;
            a.start = start;
            a.end = end;
            editDraft = null;
            renderAssignments();
          }
        }
      });

      selectAllAssignments?.addEventListener('change', ()=>{
        const check = selectAllAssignments.checked;
        document.querySelectorAll('.assignment-row').forEach(cb=>{
          cb.checked = check;
          const id = cb.dataset.id;
          if (id){
            if (check) selectedIds.add(id);
            else selectedIds.delete(id);
          }
        });
      });

      showSelectedBtn?.addEventListener('click', ()=>{
        assignmentPage = 1;
        addDraft = null;
        editDraft = null;
        renderAssignments(true);
      });

      exportBtn?.addEventListener('click', ()=>{
        alert(`Exporting ${selectedIds.size} selected assignments (demo).`);
      });

      assignGroupBtn?.addEventListener('click', ()=> openGroupModal('assign'));
      editGroupBtn?.addEventListener('click', ()=> openGroupModal('edit'));

      groupSave?.addEventListener('click', ()=>{
        if (!groupSelection.length){
          setGroupError('No students selected.');
          return;
        }
        const loc = groupLocation?.value || '';
        const startVal = groupStart?.value || '';
        const endVal = groupEnd?.value || '';
        if (!loc || !startVal || !endVal){
          setGroupError('Please choose a location and enter both start and end dates.');
          return;
        }
        const start = new Date(`${startVal}T00:00:00`);
        const end = new Date(`${endVal}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start){
          setGroupError('Please enter a valid date range (end date must be on/after start date).');
          return;
        }

        groupSelection.forEach((item, idx)=>{
          const id = `a-group-${item.student.id}-${Date.now()}-${idx}`;
          assignments.push({ id, studentId: item.student.id, location: loc, start, end, status: 'pending' });
        });

        setGroupError('');
        groupModal?.hide();
        selectedIds.clear();
        if (selectAllAssignments) selectAllAssignments.checked = false;
        document.querySelectorAll('.assignment-row').forEach(cb => {
          cb.checked = false;
        });
        renderAssignments();
      });

      renderAssignments();
    })();
  
