
	    (function(){
	      const REVIEW_DECISIONS_KEY = 'cpnw-review-decisions-v1';
	      let currentReqContext = { sid: '', reqName: '', rerenderReqs: null };

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

	      function decisionKey(sid, reqName){
	        return `${String(sid || '').trim()}|${String(reqName || '').trim()}`.toLowerCase();
	      }

	      function getDecisionRecord(sid, reqName){
	        const store = loadJSON(REVIEW_DECISIONS_KEY, {});
	        if (!store || typeof store !== 'object' || Array.isArray(store)) return null;
	        return store[decisionKey(sid, reqName)] || null;
	      }

	      function saveDecisionRecord(sid, reqName, record){
	        const store = loadJSON(REVIEW_DECISIONS_KEY, {});
	        const next = (!store || typeof store !== 'object' || Array.isArray(store)) ? {} : store;
	        next[decisionKey(sid, reqName)] = record;
	        saveJSON(REVIEW_DECISIONS_KEY, next);
	      }

	      function decisionToStatus(decision){
	        const d = String(decision || '').toLowerCase();
	        if (d === 'approve' || d === 'approved') return 'Approved';
	        if (d === 'conditional' || d === 'conditionally approved' || d === 'conditionallyapprove' || d === 'conditionally') return 'Conditionally Approved';
	        if (d === 'reject' || d === 'rejected') return 'Rejected';
	        return '';
	      }

	      function setSavedHint(){
	        const el = document.getElementById('reqDecisionSaved');
	        if (!el) return;
	        el.classList.remove('d-none');
	        window.setTimeout(() => el.classList.add('d-none'), 2200);
	      }

	      function setUploadedList(files){
	        const wrap = document.getElementById('reqUploadedWrap');
	        const list = document.getElementById('reqUploadedList');
	        if (!wrap || !list) return;
	        const items = Array.isArray(files) ? files : [];
	        if (!items.length){
	          wrap.classList.add('d-none');
	          list.innerHTML = '';
	          return;
	        }
	        wrap.classList.remove('d-none');
	        list.innerHTML = items.map(f => {
	          const name = String(f?.name || 'File');
	          const at = f?.uploadedAt ? ` • ${String(f.uploadedAt)}` : '';
	          return `<li>${name}${at}</li>`;
	        }).join('');
	      }

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
              school: (p.id === 'BSN' ? 'CPNW Education' : p.id === 'ADN' ? 'CPNW University' : 'CPNW Education')
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
        const schoolForProgram = (program) => (program === 'ADN' ? 'CPNW University' : 'CPNW Education');
        const custom = cohortAPI
          .listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX })
          .map(c => ({ ...c, school: schoolForProgram(c.program) }));
        cohorts = cohorts.concat(custom);
      }
      const cohortFilterEl = document.getElementById('cohortFilter');
      if (cohortFilterEl){
        const options = ['', '__unassigned__'];
        cohorts.forEach(c => options.push(c.cohortLabel));
        cohortFilterEl.innerHTML = options.map(opt => {
          if (!opt) return `<option value="">All cohorts</option>`;
          if (opt === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
          return `<option value="${opt}">${opt}</option>`;
        }).join('');
      }

      const people = [];
      const statusPool = ['needs-review','']; // blank = no outstanding review
      cohorts.forEach((c, idx) => {
        const count = Math.min(10, c.students);
        for (let i=0; i<count; i++){
          const dob = new Date(1995 + (i % 10), i % 12, (i % 27) + 1);
          const person = {
            name: `Student ${idx+1}-${i+1}`,
            email: `student${idx+1}${i+1}@demo.cpnw.org`,
            program: c.program,
            school: c.school,
            cohort: c.cohortLabel,
            sid: String(1000 + idx * 50 + i),
            verified: (i + idx) % 3 === 0,
            status: statusPool[(i + idx) % statusPool.length],
            phone: `(555) 01${i}${idx}-${1000 + i}`,
            emergName: `Emergency Contact ${i+1}`,
            emergPhone: `(555) 77${idx}-${2000 + i}`,
            dob
          };
          if (cohortAPI){
            const override = typeof cohortAPI.getUserCohortLabel === 'function'
              ? cohortAPI.getUserCohortLabel(person.email)
              : null;
            if (override !== null && override !== undefined){
              person.cohort = override;
            }
          }
          people.push(person);
        }
      });

      // Include faculty + faculty-admin accounts (education-role users are intentionally excluded from this table)
      function addPerson(raw){
        const person = { ...raw };
        if (cohortAPI){
          const override = typeof cohortAPI.getUserCohortLabel === 'function'
            ? cohortAPI.getUserCohortLabel(person.email)
            : null;
          if (override !== null && override !== undefined){
            person.cohort = override;
          }
        }
        people.push(person);
      }

      addPerson({
        name: 'Fran Faculty',
        email: 'fran.faculty@cpnw.org',
        program: 'BSN',
        school: 'CPNW Education',
        cohort: '',
        sid: 'EID-FF-001',
        verified: true,
        status: '',
        phone: '(555) 010-2000',
        emergName: '',
        emergPhone: '',
        dob: new Date(1988, 5, 12)
      });

      addPerson({
        name: 'Faculty Admin (Demo)',
        email: 'facadmin@cpnw.org',
        program: 'BSN',
        school: 'CPNW Education',
        cohort: '',
        sid: 'EID-FA-001',
        verified: true,
        status: '',
        phone: '(555) 010-2001',
        emergName: '',
        emergPhone: '',
        dob: new Date(1985, 9, 3)
      });

      const statusChipButtons = document.querySelectorAll('[data-status-chip]');
      const reviewTableBody = document.getElementById('reviewTableBody');
      const reviewSearch = document.getElementById('reviewSearch');
      const schoolFilter = document.getElementById('schoolFilter');
      const programFilter = document.getElementById('programFilter');
      const reviewPageSizeSelect = document.getElementById('reviewPageSize');
      const reviewPrevPage = document.getElementById('reviewPrevPage');
      const reviewNextPage = document.getElementById('reviewNextPage');
      const reviewPageInfo = document.getElementById('reviewPageInfo');
      const reviewTotal = document.getElementById('reviewTotal');
      const sortButtons = document.querySelectorAll('.sort');
      let currentStatusChip = 'all';
      let reviewPage = 1;
      let reviewPageSize = Number(reviewPageSizeSelect?.value || 10);
      let sortState = { field:'', dir:'asc' };

      const CPNW_ELEARNING = [
        'Bloodborne Pathogens and Workplace Safety',
        'Emergency Procedures',
        'Patient Rights',
        'Infection Prevention and Standard Precautions',
        'Fall Risk Prevention',
        'Patient Safety',
        'Infectious Medical Waste',
        'Magnetic Resonance Imaging Safety',
        'Chemical Hazard Communication',
        'Compliance'
      ];
      const CPNW_REQUIREMENTS = [
        'CPNW: Varicella',
        'CPNW: Influenza',
        'CPNW: Tetanus, Diphtheria, & Pertussis',
        'CPNW: Criminal History Disclosure',
        'CPNW: BLS Provider Course',
        'CPNW: Tuberculin',
        'CPNW: Hepatitis B',
        'CPNW: Measles, Mumps, and Rubella',
        'CPNW: COVID-19',
        'CPNW: Independent Background Check',
        'CPNW: Independent WATCH'
      ];
      const reqCounts = { cpnw: CPNW_ELEARNING.length + CPNW_REQUIREMENTS.length, ed:4, hc:6 };
      const reqLabels = { cpnw:'CPNW', ed:'Education', hc:'Healthcare' };
      const freqOptions = ['Annual','Once','Seasonal'];
      const typePool = ['Immunization','Forms','Certs','Insurance','Licenses','Site Orientations'];
      const reviewerPool = ['Alexis Key', 'Jordan Price', 'Sam Patel'];
      const reqStatusPool = [
        'Not Submitted',
        'Submitted',
        'In Review',
        'Approved',
        'Conditionally Approved',
        'Rejected',
        'Declination',
        'Expired',
        'Expiring',
        'Expiring Soon'
      ];

      function datePlusDays(days){
        const d = new Date(TODAY);
        d.setDate(d.getDate() + days);
        return d;
      }

      function buildReqs(overallStatus){
        const rows = [];
        Object.entries(reqCounts).forEach(([key,count])=>{
          for(let i=1;i<=count;i++){
            const isCPNW = key === 'cpnw';
            const isElearning = isCPNW && i <= CPNW_ELEARNING.length;
            const type = isElearning ? 'eLearning' : typePool[(i + count) % typePool.length];
            const frequency = isElearning ? 'Annual' : freqOptions[i % freqOptions.length];
            const category = key === 'cpnw' ? 'CPNW Clinical Passport' : key === 'ed' ? 'Education' : 'Healthcare';
            const reviewer = isElearning ? '' : reviewerPool[i % reviewerPool.length];
            let status = reqStatusPool[(i + (overallStatus === 'needs-review' ? 1 : 3) + key.length) % reqStatusPool.length];
            if (isElearning){
              if (!['Not Submitted','Approved','Expired','Expiring Soon'].includes(status)){
                status = 'Not Submitted';
              }
            }
            const hasScore = isElearning && status !== 'Not Submitted';
            const scoreVal = hasScore ? 80 + (i % 21) : '';
            let exp = frequency === 'Once' ? null : new Date(TODAY.getFullYear(), TODAY.getMonth() + (6 + i), TODAY.getDate());
            const due = null;
            if (status === 'Not Submitted'){
              exp = null;
            }
            if (isElearning){
              if (status === 'Approved'){
                exp = datePlusDays(365);
              }else if (status === 'Expiring Soon'){
                exp = datePlusDays(20);
              }else if (status === 'Expired'){
                exp = datePlusDays(-7);
              }
            }
            const name = isCPNW
              ? (isElearning ? CPNW_ELEARNING[i - 1] : CPNW_REQUIREMENTS[i - 1 - CPNW_ELEARNING.length])
              : `${reqLabels[key]} Req ${i}`;
            rows.push({
              name,
              status,
              expiration: exp,
              dueDate: null,
              score: scoreVal,
              type,
              frequency,
              category,
              reviewer
            });
          }
        });
        return rows;
      }

      const messageThreads = {
        'CPNW: Hepatitis B': [
          [
            { from:'Student', to:['Education'], body:'I just uploaded my proof for Hep B.', at:'2025-02-01' },
            { from:'Education', to:['Student'], body:'Got it—please confirm the date on page 2 is signed.', at:'2025-02-02' }
          ]
        ],
        'CPNW: Criminal History Disclosure': [
          [
            { from:'Student', to:['Healthcare'], body:'Need clarification on site orientation steps.', at:'2025-02-03' },
            { from:'Healthcare', to:['Student'], body:'Please complete module 1 before Friday.', at:'2025-02-03' }
          ]
        ]
      };
      let currentReqThreadKey = '';
      let currentReplyThreadIndex = null;

      function statusBadge(val){
        if (!val) return '<span class="text-body-secondary">—</span>';
        const map = {
          'needs-review': { text:'Needs review', cls:'text-bg-warning text-dark' },
          'approved': { text:'Approved', cls:'text-bg-success' },
          'returned': { text:'Returned', cls:'text-bg-danger' }
        };
        const info = map[val] || { text: val, cls:'text-bg-secondary' };
        return `<span class="badge ${info.cls}">${info.text}</span>`;
      }

      function renderReviews(){
        const q = (reviewSearch?.value || '').toLowerCase();
        const school = schoolFilter?.value || '';
        const program = programFilter?.value || '';
        const validCohorts = new Set([...cohorts.map(c=>c.cohortLabel), '__unassigned__']);
        const cohortSel = cohortFilterEl && cohortFilterEl.value && validCohorts.has(cohortFilterEl.value) ? cohortFilterEl.value : '';

        const filtered = people.filter(p=>{
          if (currentStatusChip !== 'all' && p.status !== currentStatusChip) return false;
          if (cohortSel){
            if (cohortSel === '__unassigned__'){
              if ((p.cohort || '').trim()) return false;
            }else{
              if (p.cohort !== cohortSel) return false;
            }
          }
          if (school && p.school !== school) return false;
          if (program && p.program !== program) return false;
          if (q && !`${p.name} ${p.sid} ${p.email}`.toLowerCase().includes(q)) return false;
          return true;
        });

        // Needs review first, then blanks
        filtered.sort((a,b)=>{
          const aNeeds = a.status === 'needs-review' ? 0 : 1;
          const bNeeds = b.status === 'needs-review' ? 0 : 1;
          if (aNeeds !== bNeeds) return aNeeds - bNeeds;

          const field = sortState.field;
          const dir = sortState.dir === 'desc' ? -1 : 1;
          if (!field){
            return a.name.localeCompare(b.name);
          }
          const valA = (a[field] ?? '').toString().toLowerCase();
          const valB = (b[field] ?? '').toString().toLowerCase();
          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
          return a.name.localeCompare(b.name);
        });

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / reviewPageSize));
        if (reviewPage > totalPages) reviewPage = totalPages;
        const startIdx = (reviewPage - 1) * reviewPageSize;
        const endIdx = Math.min(startIdx + reviewPageSize, total);
        const pageItems = filtered.slice(startIdx, endIdx);

        reviewTableBody.innerHTML = pageItems.map(p=>`
          <tr>
            <td class="fw-semibold">${p.name}</td>
            <td>${p.verified ? '✓' : ''}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${p.program}</td>
            <td>${p.school}</td>
            <td>${p.cohort ? p.cohort : '<span class="text-body-secondary">Unassigned</span>'}</td>
            <td>${p.sid}</td>
            <td class="text-end"><button class="btn btn-outline-secondary btn-sm" data-review="${p.sid}">View</button></td>
          </tr>
        `).join('');

        if (reviewPageInfo){
          reviewPageInfo.textContent = total ? `Showing ${startIdx + 1}–${endIdx} of ${total}` : 'No results';
        }
        if (reviewPrevPage && reviewNextPage){
          reviewPrevPage.disabled = reviewPage <= 1;
          reviewNextPage.disabled = endIdx >= total;
        }
      }

      statusChipButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          statusChipButtons.forEach(b=>{
            b.classList.remove('btn-cpnw','btn-cpnw-primary');
            b.classList.add('btn-outline-secondary');
          });
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
          currentStatusChip = btn.dataset.statusChip;
          reviewPage = 1;
          renderReviews();
        });
      });

      [reviewSearch, schoolFilter, programFilter, cohortFilterEl].forEach(el=>{
        if (!el) return;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', ()=>{
          reviewPage = 1;
          renderReviews();
        });
      });

      reviewPageSizeSelect?.addEventListener('change', ()=>{
        reviewPageSize = Number(reviewPageSizeSelect.value || 10);
        reviewPage = 1;
        renderReviews();
      });

      reviewPrevPage?.addEventListener('click', ()=>{
        if (reviewPage > 1){
          reviewPage -= 1;
          renderReviews();
        }
      });
      reviewNextPage?.addEventListener('click', ()=>{
        reviewPage += 1;
        renderReviews();
      });

      // initialize status buttons (set "All" active)
      statusChipButtons.forEach(btn=>{
        if (btn.dataset.statusChip === 'all'){
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-cpnw','btn-cpnw-primary');
        }
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
          renderReviews();
        });
      });

      document.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-review]');
        if (!btn) return;
        const sid = btn.dataset.review;
        const person = people.find(p=>p.sid === sid);
        if (!person) return;
        document.getElementById('reviewModalLabel').textContent = person.name;
        document.getElementById('reviewModalSub').textContent = person.email;
        document.getElementById('modalSchool').textContent = person.school;
        document.getElementById('modalProgram').textContent = person.program;
        document.getElementById('modalCohort').textContent = person.cohort;
        document.getElementById('modalSid').textContent = person.sid;
        document.getElementById('modalEmail').textContent = person.email;
        document.getElementById('modalPhone').textContent = person.phone || '—';
        document.getElementById('modalEmergName').textContent = person.emergName || '—';
        document.getElementById('modalEmergPhone').textContent = person.emergPhone || '—';
        document.getElementById('modalDob').textContent = person.dob ? person.dob.toLocaleDateString() : '—';

        // Clinical assignments (sample)
        const assignBody = document.getElementById('assignTableBody');
        const assignStatuses = ['Approved','Rejected',''];
        const assignRows = Array.from({length:3},(_,i)=>{
          const start = new Date(TODAY);
          start.setDate(start.getDate() - (60 - i*10));
          const end = new Date(start);
          end.setDate(end.getDate() + 60);
          return {
            location: i % 2 === 0 ? 'CPNW Medical Center' : 'CPNW Healthcare Facility',
            start,
            end,
            status: assignStatuses[(i + person.sid.length) % assignStatuses.length]
          };
        });
        assignBody.innerHTML = assignRows.map(a=>`
          <tr>
            <td>${a.location}</td>
            <td>${a.start.toLocaleDateString()}</td>
            <td>${a.end.toLocaleDateString()}</td>
            <td>${a.status || '—'}</td>
          </tr>
        `).join('');

        // Requirements with pagination within modal
        let reqPageSize = Number(document.getElementById('reqPageSize')?.value || 10);
        let reqPage = 1;
        const reqRows = buildReqs(person.status === 'needs-review' ? 'needs-review' : 'complete');
        const orderedReqs = [
          ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type !== 'eLearning'),
          ...reqRows.filter(r => r.category === 'Education'),
          ...reqRows.filter(r => r.category === 'Healthcare'),
          ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type === 'eLearning')
        ];
        const reqBody = document.getElementById('reqTableBody');
        const fmt = (d) => d instanceof Date ? d.toLocaleDateString() : '—';
        const reqPrev = document.getElementById('reqPrev');
        const reqNext = document.getElementById('reqNext');
        const reqPageInfo = document.getElementById('reqPageInfo');

        function renderReqs(){
          const total = orderedReqs.length;
          const totalPages = Math.max(1, Math.ceil(total / reqPageSize));
          if (reqPage > totalPages) reqPage = totalPages;
          const start = (reqPage - 1) * reqPageSize;
          const end = Math.min(start + reqPageSize, total);
          const pageItems = orderedReqs.slice(start, end);
	        reqBody.innerHTML = pageItems.map((r, idx)=>{
	          const saved = getDecisionRecord(person.sid, r.name);
	          const savedStatus = decisionToStatus(saved?.decision);
	          let effectiveStatus = savedStatus || r.status;
	          if (r.type === 'eLearning' && !['Not Submitted','Approved','Expired','Expiring Soon'].includes(effectiveStatus)){
	            effectiveStatus = 'Not Submitted';
	          }
	          let statusBadge = '<span class="badge text-bg-secondary">Not Submitted</span>';
	          const statusMap = {
	            'Not Submitted':'text-bg-secondary',
	            'Submitted':'text-bg-info text-dark',
	            'In Review':'text-bg-warning text-dark',
	            'Approved':'text-bg-success',
	            'Conditionally Approved':'text-bg-primary',
	            'Rejected':'text-bg-danger',
	            'Declination':'text-bg-danger-subtle text-danger',
	            'Expired':'text-bg-dark',
	            'Expiring':'text-bg-warning text-dark',
	            'Expiring Soon':'text-bg-warning text-dark'
	          };
	            if (effectiveStatus && statusMap[effectiveStatus]){
	              statusBadge = `<span class="badge ${statusMap[effectiveStatus]}">${effectiveStatus}</span>`;
	            }
            const scoreCell = r.type === 'eLearning' ? (r.score || '—') : '—';
          const abbr = r.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,6);
          const requiredBy = r.category === 'CPNW Clinical Passport' ? 'CPNW' : r.category === 'Education' ? 'Education' : 'CPNW Healthcare Facility';
          const nameCell = r.type === 'eLearning'
            ? `<span class="text-body-secondary">${r.name}</span>`
            : `<button class="btn btn-link p-0 text-decoration-none req-detail-btn" data-req-detail="1" data-req-index="${start + idx}" data-req-name="${r.name}" data-req-abbr="${abbr}" data-req-requiredby="${requiredBy}" data-req-instructions="Follow the instructions to submit required proof for ${r.name}." data-req-category="${r.category}">${r.name}</button>`;
          return `
            <tr>
              <td>${nameCell}</td>
              <td>${statusBadge}</td>
              <td>${fmt(r.expiration)}</td>
              <td>${fmt(r.dueDate)}</td>
              <td>${scoreCell}</td>
              <td>${r.type}</td>
              <td>${r.frequency}</td>
              <td>${r.category}</td>
              <td>${r.reviewer}</td>
            </tr>
          `;
          }).join('');

          if (reqPageInfo){
            reqPageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
          }
          if (reqPrev && reqNext){
            reqPrev.disabled = reqPage <= 1;
            reqNext.disabled = end >= total;
          }
        }

        const reqPageSizeSelect = document.getElementById('reqPageSize');
        if (reqPageSizeSelect){
          reqPageSizeSelect.onchange = () => {
            reqPageSize = Number(reqPageSizeSelect.value || 10);
            reqPage = 1;
            renderReqs();
          };
        }

        reqPrev?.addEventListener('click', ()=>{
          if (reqPage > 1){
            reqPage -= 1;
            renderReqs();
          }
        });
        reqNext?.addEventListener('click', ()=>{
          reqPage += 1;
          renderReqs();
        });

	        renderReqs();
	        const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
	        modal.show();
        const reviewModalEl = document.getElementById('reviewModal');
        reviewModalEl.dataset.studentName = person.name;
        reviewModalEl.dataset.studentSid = person.sid;
        reviewModalEl.dataset.studentEmail = person.email;
        currentReqContext = { sid: person.sid, reqName: '', rerenderReqs: renderReqs };
      });

      function renderThread(){
        const threadWrap = document.getElementById('msgThread');
        if (!threadWrap) return;
        let threads = messageThreads[currentReqThreadKey] || [];
        // Backward compatibility: if stored as flat array, wrap as single thread
        if (threads.length && !Array.isArray(threads[0])){
          threads = [threads];
          messageThreads[currentReqThreadKey] = threads;
        }
        if (!threads.length){
          threadWrap.innerHTML = '<div class="text-body-secondary small">No messages yet.</div>';
          return;
        }
        threadWrap.innerHTML = threads.map((msgs, threadIdx)=>`
          <div class="border rounded p-2">
            <div class="small fw-semibold mb-1">Thread ${threadIdx + 1}</div>
            ${msgs.map(m=>`
              <div class="border rounded p-2 mb-2">
                <div class="small fw-semibold">${m.from} → ${m.to.join(', ')}</div>
                <div class="small text-body-secondary">${m.at || ''}</div>
                <div class="small mb-1">${m.body}</div>
                <button class="btn btn-link p-0 small msg-reply" type="button" data-reply-thread="${threadIdx}" data-reply-to="${m.from}" data-reply-recipients="${m.to.join('|')}">Reply</button>
              </div>
            `).join('')}
          </div>
        `).join('');
      }

      // requirement detail click (delegate)
      document.addEventListener('click', (ev)=>{
        const btn = ev.target.closest('.req-detail-btn');
        if (!btn) return;
        const name = btn.dataset.reqName || '';
        const abbr = btn.dataset.reqAbbr || '';
        const requiredBy = btn.dataset.reqRequiredby || '';
        const instructions = btn.dataset.reqInstructions || '';
        const category = btn.dataset.reqCategory || '';
        const student = btn.closest('#reviewModal')?.dataset?.studentName || document.getElementById('reqDetailStudent')?.textContent || '';
        const sid = btn.closest('#reviewModal')?.dataset?.studentSid || '';
        const studentEmail = btn.closest('#reviewModal')?.dataset?.studentEmail || '';
        document.getElementById('reqDetailStudent').textContent = student;
        const studentEmailEl = document.getElementById('reqDetailStudentEmail');
        if (studentEmailEl) studentEmailEl.textContent = studentEmail;
        document.getElementById('reqDetailModalLabel').textContent = name;
	        document.getElementById('reqDetailMeta').textContent = `Abbreviation: ${abbr} • Required by: ${requiredBy}`;
	        document.getElementById('reqDetailInstructions').textContent = instructions;
        const msgRecipient = document.getElementById('msgRecipient');
        if (msgRecipient){
          const options = [
            { value:'Student', label:'Student' },
            { value:'Healthcare', label:'Healthcare' }
          ];
          if (category === 'CPNW Clinical Passport'){
            options.splice(1,0,{ value:'CPNW Reviewer', label:'CPNW Reviewer' });
          }
          msgRecipient.innerHTML = options.map(opt=>`
            <label class="form-check d-flex align-items-center gap-2">
              <input class="form-check-input" type="checkbox" value="${opt.value}">
              <span>${opt.label}</span>
            </label>
          `).join('');
	        }
	        // reset decision/notes
	        document.querySelectorAll('.req-submission').forEach(r=>r.checked=false);
	        document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
	        document.querySelectorAll('.decision-radio').forEach(r=>r.checked=false);
	        document.getElementById('decisionReasonWrap').classList.add('d-none');
	        const reasonEl = document.getElementById('decisionReason');
	        if (reasonEl) reasonEl.value = '';
	        const vaccDate = document.getElementById('vaccDate');
	        const seriesStart = document.getElementById('seriesStart');
	        const seriesDue = document.getElementById('seriesDue');
	        const otherNotes = document.getElementById('otherNotes');
	        if (vaccDate) vaccDate.value = '';
	        if (seriesStart) seriesStart.value = '';
	        if (seriesDue) seriesDue.value = '';
	        if (otherNotes) otherNotes.value = '';
	        ['declEgg','declIngredient','declGB','declOther'].forEach(id=>{
	          const el = document.getElementById(id);
	          if (el) el.checked = false;
	        });
	        const uploadEl = document.getElementById('reqUpload');
	        if (uploadEl) uploadEl.value = '';
	        setUploadedList([]);

	        // Load saved decision if present
	        if (sid){
	          const saved = getDecisionRecord(sid, name);
	          if (saved){
	            const submission = String(saved.submission?.type || '');
	            if (submission){
	              const subEl = document.getElementById(submission);
	              if (subEl){
	                subEl.checked = true;
	                document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
	                const targetId = subEl.dataset.target;
	                if (targetId){
	                  document.getElementById(targetId)?.classList.remove('d-none');
	                }
	              }
	            }
	            if (vaccDate) vaccDate.value = saved.submission?.vaccDate || '';
	            if (seriesStart) seriesStart.value = saved.submission?.seriesStart || '';
	            if (seriesDue) seriesDue.value = saved.submission?.seriesDue || '';
	            if (otherNotes) otherNotes.value = saved.submission?.otherNotes || '';

	            const decl = saved.declination || {};
	            const declEgg = document.getElementById('declEgg');
	            const declIngredient = document.getElementById('declIngredient');
	            const declGB = document.getElementById('declGB');
	            const declOther = document.getElementById('declOther');
	            if (declEgg) declEgg.checked = !!decl.egg;
	            if (declIngredient) declIngredient.checked = !!decl.ingredient;
	            if (declGB) declGB.checked = !!decl.gb;
	            if (declOther) declOther.checked = !!decl.other;

	            const decision = String(saved.decision || '').toLowerCase();
	            const decApprove = document.getElementById('decApprove');
	            const decConditional = document.getElementById('decConditional');
	            const decReject = document.getElementById('decReject');
	            if (decApprove) decApprove.checked = decision === 'approve' || decision === 'approved';
	            if (decConditional) decConditional.checked = decision === 'conditional' || decision === 'conditionally approved';
	            if (decReject) decReject.checked = decision === 'reject' || decision === 'rejected';

	            const needsReason = !!decConditional?.checked || !!decReject?.checked;
	            document.getElementById('decisionReasonWrap')?.classList.toggle('d-none', !needsReason);
	            if (reasonEl) reasonEl.value = saved.decisionReason || '';
	            setUploadedList(saved.uploads || []);
	          }
	        }

	        const reviewModalEl = document.getElementById('reviewModal');
	        const reviewModalInstance = reviewModalEl ? bootstrap.Modal.getInstance(reviewModalEl) || new bootstrap.Modal(reviewModalEl) : null;
	        const reqModalEl = document.getElementById('reqDetailModal');
	        const reqModal = new bootstrap.Modal(reqModalEl);
	        reqModalEl.dataset.reqSid = sid;
	        reqModalEl.dataset.reqName = name;
	        currentReqContext = { ...currentReqContext, sid, reqName: name };

	        window.__reviewWasOpen = reviewModalEl?.classList.contains('show');
        if (window.__reviewWasOpen && reviewModalInstance){
          reviewModalInstance.hide();
        }
        currentReqThreadKey = name;
        currentReplyThreadIndex = null;
        renderThread();
        reqModal.show();
      });

      // submission radio toggle
      document.addEventListener('change', (e)=>{
        if (!e.target.classList.contains('req-submission')) return;
        document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
        const targetId = e.target.dataset.target;
        if (targetId){
          const tgt = document.getElementById(targetId);
          if (tgt) tgt.classList.remove('d-none');
        }
      });

      // decision reason toggle
      document.addEventListener('change', (e)=>{
        if (!e.target.classList.contains('decision-radio')) return;
        const requires = e.target.hasAttribute('data-requires-reason');
        const wrap = document.getElementById('decisionReasonWrap');
        if (wrap){
          wrap.classList.toggle('d-none', !requires);
        }
      });

      // Save decision + submission/declination + uploads (demo persistence)
      document.addEventListener('click', (e) => {
        if (e.target.id !== 'reqDecisionSave') return;
        const modalEl = document.getElementById('reqDetailModal');
        const sid = modalEl?.dataset?.reqSid || '';
        const reqName = modalEl?.dataset?.reqName || document.getElementById('reqDetailModalLabel')?.textContent || '';
        if (!sid || !reqName){
          alert('Unable to save: missing student/requirement context.');
          return;
        }

        const decision =
          document.getElementById('decApprove')?.checked ? 'Approved' :
          document.getElementById('decConditional')?.checked ? 'Conditionally Approved' :
          document.getElementById('decReject')?.checked ? 'Rejected' :
          '';
        const decisionReason = (document.getElementById('decisionReason')?.value || '').trim();
        if ((decision === 'Conditionally Approved' || decision === 'Rejected') && !decisionReason){
          alert('Please enter a reason for conditional approval or rejection.');
          return;
        }

        const submissionType = document.getElementById('subVaccinated')?.checked ? 'subVaccinated' :
          document.getElementById('subSeries')?.checked ? 'subSeries' :
          document.getElementById('subOther')?.checked ? 'subOther' :
          '';

        const existing = getDecisionRecord(sid, reqName) || {};
        const existingUploads = Array.isArray(existing.uploads) ? existing.uploads.slice() : [];
        const files = Array.from(document.getElementById('reqUpload')?.files || []);
        const newUploads = files.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
          uploadedAt: new Date().toISOString().slice(0, 10)
        }));

        const record = {
          savedAt: new Date().toISOString(),
          decision,
          decisionReason,
          submission: {
            type: submissionType,
            vaccDate: document.getElementById('vaccDate')?.value || '',
            seriesStart: document.getElementById('seriesStart')?.value || '',
            seriesDue: document.getElementById('seriesDue')?.value || '',
            otherNotes: (document.getElementById('otherNotes')?.value || '').trim()
          },
          declination: {
            egg: !!document.getElementById('declEgg')?.checked,
            ingredient: !!document.getElementById('declIngredient')?.checked,
            gb: !!document.getElementById('declGB')?.checked,
            other: !!document.getElementById('declOther')?.checked
          },
          uploads: existingUploads.concat(newUploads)
        };

        saveDecisionRecord(sid, reqName, record);
        const uploadEl = document.getElementById('reqUpload');
        if (uploadEl) uploadEl.value = '';
        setUploadedList(record.uploads);
        setSavedHint();

        if (typeof currentReqContext?.rerenderReqs === 'function' && currentReqContext.sid === sid){
          currentReqContext.rerenderReqs();
        }
      });

      // send message
      document.addEventListener('click', (e)=>{
        if (e.target.id !== 'msgSend') return;
        const recipients = Array.from(document.querySelectorAll('#msgRecipient input:checked')).map(i=>i.value);
        const body = document.getElementById('msgBody')?.value.trim() || '';
        if (!recipients.length || !body){
          alert('Please select at least one recipient and enter a message.');
          return;
        }
        const thread = messageThreads[currentReqThreadKey] || [];
        // Ensure thread structure
        let threads = thread;
        if (threads.length && !Array.isArray(threads[0])) threads = [threads];
        if (!threads.length) threads = [];
        if (currentReplyThreadIndex === null){
          // new thread
          threads.push([{ from:'Education', to: recipients, body, at: new Date().toLocaleString() }]);
        }else{
          const target = threads[currentReplyThreadIndex] || [];
          target.push({ from:'Education', to: recipients, body, at: new Date().toLocaleString() });
          threads[currentReplyThreadIndex] = target;
        }
        messageThreads[currentReqThreadKey] = threads;
        document.getElementById('msgBody').value = '';
        currentReplyThreadIndex = null;
        renderThread();
      });

      // reply button populate recipients and hint
      document.addEventListener('click', (e)=>{
        const replyBtn = e.target.closest('.msg-reply');
        if (!replyBtn) return;
        const recips = (replyBtn.dataset.replyRecipients || '').split('|').filter(Boolean);
        document.querySelectorAll('#msgRecipient input').forEach(cb=>{
          cb.checked = recips.includes(cb.value);
        });
        const body = document.getElementById('msgBody');
        if (body){
          const to = replyBtn.dataset.replyTo ? `@${replyBtn.dataset.replyTo}: ` : '';
          body.value = to;
          body.focus();
        }
        const threadIdx = replyBtn.dataset.replyThread;
        currentReplyThreadIndex = threadIdx ? Number(threadIdx) : null;
      });

      // When req detail closes, re-show review modal if it was open
      const reqDetailModalEl = document.getElementById('reqDetailModal');
      if (reqDetailModalEl){
        reqDetailModalEl.addEventListener('hidden.bs.modal', ()=>{
          if (window.__reviewWasOpen){
            const reviewModalEl = document.getElementById('reviewModal');
            const reviewModalInstance = reviewModalEl ? bootstrap.Modal.getInstance(reviewModalEl) || new bootstrap.Modal(reviewModalEl) : null;
            reviewModalInstance?.show();
            window.__reviewWasOpen = false;
          }
        });
      }

      renderReviews();
    })();
  
