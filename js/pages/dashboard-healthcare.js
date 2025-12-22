
    (function(){
      const programs = [
        { id:'bsn', name:'BSN' },
        { id:'adn', name:'ADN' },
        { id:'surg', name:'Surg Tech' },
        { id:'allied', name:'Allied Health' }
      ];

	      const requests = [
	        { school:'Northwest U', program:'BSN', programId:'bsn', students:8, start:'Mar 18', status:'pending' },
	        { school:'Evergreen College', program:'Allied Health', programId:'allied', students:4, start:'Mar 25', status:'approved' },
	        { school:'Cascade State', program:'Practicum', programId:'bsn', students:6, start:'Apr 02', status:'reviewing' },
	        { school:'CPNW Education', program:'ADN', programId:'adn', students:5, start:'Apr 10', status:'pending' }
	      ];

	      // Demo: healthcare requirements that have been submitted by students and are awaiting review.
	      // "Submitted" means it has been uploaded/entered but not yet approved/conditionally approved/rejected.
	      const healthcareRequirements = [
	        { studentId: 'stu-1', studentName: 'Sam Student', programId: 'bsn', requirement: 'TB Test', status: 'submitted' },
	        { studentId: 'stu-1', studentName: 'Sam Student', programId: 'bsn', requirement: 'Flu Vaccine', status: 'approved' },
	        { studentId: 'stu-2', studentName: 'Jordan Learner', programId: 'adn', requirement: 'Background Check Authorization', status: 'submitted' },
	        { studentId: 'stu-3', studentName: 'Taylor Trainee', programId: 'allied', requirement: 'CPR Card', status: 'rejected' },
	        { studentId: 'stu-4', studentName: 'Morgan Intern', programId: 'surg', requirement: 'N95 Fit Test', status: 'conditionally approved' }
	      ];

	      const sites = [
	        { name:'Med-Surg (Downtown)', slots:4, status:'open' },
	        { name:'ICU (North Campus)', slots:1, status:'limited' },
	        { name:'Pediatrics (East)', slots:0, status:'full' }
	      ];

      const filters = document.getElementById('programFilters');
      const programCount = document.getElementById('programCount');
      const programSearch = document.getElementById('programSearch');
      const selectAllBtn = document.getElementById('programSelectAll');
      const clearBtn = document.getElementById('programClear');
      const requestTableBody = document.getElementById('requestTableBody');
      const siteList = document.getElementById('siteList');

      const metricPending = document.getElementById('metricPending');
      const metricPendingNote = document.getElementById('metricPendingNote');
      const metricApproved = document.getElementById('metricApproved');
      const metricApprovedNote = document.getElementById('metricApprovedNote');
      const metricVerified = document.getElementById('metricVerified');
      const metricVerifiedNote = document.getElementById('metricVerifiedNote');
      const metricExpiring = document.getElementById('metricExpiring');
      const metricExpiringNote = document.getElementById('metricExpiringNote');

      if (!filters) return;

      function statusBadge(status){
        const s = String(status || '').toLowerCase();
        if (s === 'pending') return '<span class="badge text-bg-warning text-dark">Pending</span>';
        if (s === 'approved') return '<span class="badge text-bg-success">Approved</span>';
        if (s === 'reviewing') return '<span class="badge text-bg-secondary">Reviewing</span>';
        return `<span class="badge text-bg-secondary">${status}</span>`;
      }

      function renderProgramFilters(term = ''){
        const existing = new Set(Array.from(filters.querySelectorAll('input:checked')).map(i => i.value));
        const hadSelection = existing.size > 0;
        filters.innerHTML = '';
        const q = String(term || '').trim().toLowerCase();
        programs
          .filter(p => !q || p.name.toLowerCase().includes(q))
          .forEach(p => {
            const id = `program-${p.id}`;
            const label = document.createElement('label');
            label.className = 'd-flex align-items-center gap-2 form-check-label';
            label.htmlFor = id;
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.id = id;
            input.value = p.id;
            input.checked = hadSelection ? existing.has(p.id) : true;
            const textSpan = document.createElement('span');
            textSpan.textContent = p.name;
            label.appendChild(input);
            label.appendChild(textSpan);
            filters.appendChild(label);
          });
      }

      function getSelectedProgramIds(){
        return Array.from(filters.querySelectorAll('input:checked')).map(i => i.value);
      }

	      function summarize(){
	        const selectedIds = getSelectedProgramIds();
	        const effective = selectedIds.length ? selectedIds : programs.map(p => p.id);
	        if (programCount){
	          programCount.textContent = effective.length === programs.length ? 'All' : String(effective.length);
	        }

	        const filteredRequests = requests.filter(r => effective.includes(r.programId));
	        const submittedReviewStudentCount = new Set(
	          healthcareRequirements
	            .filter(r => effective.includes(r.programId))
	            .filter(r => String(r.status || '').toLowerCase() === 'submitted')
	            .map(r => r.studentId)
	        ).size;
	        const pending = filteredRequests.filter(r => r.status === 'pending').length;
	        const approved = filteredRequests.filter(r => r.status === 'approved').length;
	        // Demo placeholders for readiness/expiring that scale with request totals.
	        const verified = 24 + approved * 2;
	        const expiring = Math.max(0, 3 + pending - approved);

	        if (metricPending) metricPending.textContent = String(submittedReviewStudentCount);
	        if (metricPendingNote) metricPendingNote.textContent = submittedReviewStudentCount ? 'Submitted and awaiting review' : 'No submissions to review';
	        if (metricApproved) metricApproved.textContent = String(approved);
	        if (metricApprovedNote) metricApprovedNote.textContent = approved ? 'Starting this month' : 'None starting this month';
	        if (metricVerified) metricVerified.textContent = String(verified);
	        if (metricVerifiedNote) metricVerifiedNote.textContent = 'All requirements passed';
	        if (metricExpiring) metricExpiring.textContent = String(expiring);
        if (metricExpiringNote) metricExpiringNote.textContent = expiring ? 'Follow up this week' : 'No expiring items';

        if (requestTableBody){
          requestTableBody.innerHTML = filteredRequests.map(r => `
            <tr>
              <td class="fw-semibold">${r.school}</td>
              <td>${r.program}</td>
              <td>${r.students}</td>
              <td>${r.start}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="text-body-secondary small">No requests match your filters.</td></tr>';
        }

        if (siteList){
          siteList.innerHTML = sites.map(s => {
            const badge = s.status === 'open'
              ? '<span class="badge text-bg-success">Open</span>'
              : s.status === 'limited'
                ? '<span class="badge text-bg-warning text-dark">Limited</span>'
                : '<span class="badge text-bg-secondary">Full</span>';
            const sub = s.slots ? `${s.slots} slot${s.slots === 1 ? '' : 's'} open` : 'Waitlist';
            return `
              <li class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-semibold">${s.name}</div>
                  <p class="small text-body-secondary mb-0">${sub}</p>
                </div>
                ${badge}
              </li>
            `;
          }).join('');
        }
      }

      renderProgramFilters('');
      summarize();

      filters.addEventListener('change', summarize);
      programSearch?.addEventListener('input', (e) => {
        renderProgramFilters(e.target.value || '');
        summarize();
      });
      selectAllBtn?.addEventListener('click', () => {
        filters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
        summarize();
      });
      clearBtn?.addEventListener('click', () => {
        filters.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
        summarize();
      });
    })();
  

