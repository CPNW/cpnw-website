
	    (function(){
	      const REVIEW_DECISIONS_KEY = 'cpnw-review-decisions-v1';
	      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
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
          return `
            <li class="d-flex justify-content-between align-items-center gap-2">
              <span>${name}${at}</span>
              <button class="btn btn-outline-secondary btn-sm" type="button" data-download-file="${encodeURIComponent(name)}" data-allow-locked="true">Download</button>
            </li>
          `;
        }).join('');
      }

      function downloadUploadedFile(name){
        const safeName = String(name || 'upload.txt').trim() || 'upload.txt';
        const content = `Demo file download: ${safeName}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      function downloadTuberculinForm(){
        const content = '%PDF-1.4\n% TBCheckForm.pdf demo file\n';
        const blob = new Blob([content], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'TBCheckForm.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      function downloadSeriesInProcessForm(){
        const content = [
          'CPNW Hepatitis B Series In Process Form',
          '',
          'Name: _____________________________',
          'Program: __________________________',
          'Series progress (dates):',
          '  Dose 1: __________',
          '  Dose 2: __________',
          '  Dose 3 (if applicable): __________',
          '',
          'Signature: _________________________',
          'Date: ______________________________'
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'CPNW-HepB-Series-In-Process.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];

      const isHealthcareView = window.location.pathname.includes('/healthcare-views/');
      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
      const ASSIGNMENT_GRACE_DAYS = 14;
      const HEALTHCARE_REVIEWABLE_STATUSES = new Set(['Submitted', 'In Review']);
      const HEALTHCARE_EXPIRING_STATUSES = new Set(['Expired', 'Expiring', 'Expiring Soon']);
      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;

      const programDefs = [
        { id:'BSN', base: 12, aySpan: 2 },
        { id:'ADN', base: 10, aySpan: 2 },
        { id:'Surg Tech', base: 8, aySpan: 2 },
        { id:'Radiologic Technology', base: 6, aySpan: 2 },
        { id:'Respiratory Care', base: 7, aySpan: 2 },
        { id:'Medical Assistant', base: 6, aySpan: 2 },
        { id:'Diagnostic Medical Sonography', base: 6, aySpan: 2 }
      ];
      const termAdjust = { Fall:3, Winter:1, Spring:0, Summer:-2 };
      const assignmentLocations = ['CPNW Medical Center','CPNW Healthcare Facility','Evergreen Health','Providence NW'];
      const assignmentStatusPool = ['approved','pending','rejected'];

      function normalize(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeEmail(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeProgramToken(value){
        const name = normalize(value).replace(/[^a-z0-9]/g, '');
        if (name.includes('surg')) return 'surgtech';
        if (name.includes('rad')) return 'radtech';
        if (name.includes('resp')) return 'respcare';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'medicalassistant';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function formatProgramLabel(value){
        const name = normalize(value);
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('resp')) return 'Respiratory Care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'Diagnostic Medical Sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'Medical Assistant';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return String(value || '').trim();
      }

      function hydrateAssignments(list){
        if (!Array.isArray(list)) return null;
        return list.map(item => {
          if (!item || typeof item !== 'object') return null;
          const start = item.start ? new Date(item.start) : null;
          const end = item.end ? new Date(item.end) : null;
          return { ...item, start, end };
        }).filter(Boolean);
      }

      function serializeAssignments(list){
        return (Array.isArray(list) ? list : []).map(item => ({
          ...item,
          start: item.start instanceof Date ? item.start.toISOString() : item.start,
          end: item.end instanceof Date ? item.end.toISOString() : item.end
        }));
      }

      function loadAssignments(){
        const stored = loadJSON(ASSIGNMENTS_KEY, null);
        if (!stored || !Array.isArray(stored)) return null;
        return hydrateAssignments(stored);
      }

      function saveAssignments(list){
        saveJSON(ASSIGNMENTS_KEY, serializeAssignments(list));
      }

      function getHealthcareFacilityNames(){
        if (!currentUser?.permissions?.canCoordinate) return new Set();
        const names = [
          currentUser.profile?.program,
          currentUser.profile?.school,
          ...(currentUser.programs || []),
          ...(currentUser.schools || [])
        ];
        return new Set(names.map(normalize).filter(Boolean));
      }

      function seedAssignmentsFromPeople(list){
        const assignments = [];
        list.forEach(person => {
          if (!person.studentId) return;
          const parts = String(person.studentId).split('-');
          const idx = Number(parts[0]) - 1;
          const i = Number(parts[1]) - 1;
          if (!Number.isFinite(idx) || !Number.isFinite(i)) return;
          const hasCurrentUpcoming = ((idx + i) % 5) !== 0;
          const hasPast = ((idx + i) % 3) !== 0;

          if (hasPast){
            const startPast = new Date(TODAY);
            startPast.setDate(startPast.getDate() - (120 + idx * 3 + i));
            const endPast = new Date(startPast);
            endPast.setDate(endPast.getDate() + 60);
            assignments.push({
              id: `a-past-${person.studentId}`,
              studentId: person.studentId,
              studentSid: person.sid,
              location: assignmentLocations[(i + idx) % assignmentLocations.length],
              start: startPast,
              end: endPast,
              status: assignmentStatusPool[(i + idx + 1) % assignmentStatusPool.length]
            });
          }

          if (hasCurrentUpcoming){
            const start = new Date(TODAY);
            start.setDate(start.getDate() + (idx * 8) + i * 2);
            const end = new Date(start);
            end.setDate(end.getDate() + 90);
            assignments.push({
              id: `a-cur-${person.studentId}`,
              studentId: person.studentId,
              studentSid: person.sid,
              location: assignmentLocations[(i + idx + 2) % assignmentLocations.length],
              start,
              end,
              status: assignmentStatusPool[(i + idx) % assignmentStatusPool.length]
            });
          }
        });
        return assignments;
      }

      function assignmentWithinWindow(assignment){
        const end = assignment?.end instanceof Date ? assignment.end : (assignment?.end ? new Date(assignment.end) : null);
        if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;
        const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const cutoff = new Date(endDate);
        cutoff.setDate(cutoff.getDate() + ASSIGNMENT_GRACE_DAYS);
        const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
        return cutoff >= today;
      }

      function assignmentMatchesFacility(assignment, facilityNames){
        if (!facilityNames.size) return false;
        const loc = normalize(assignment?.location);
        return facilityNames.has(loc);
      }

      function buildAssignmentEligibility(assignments, facilityNames){
        const ids = new Set();
        const sids = new Set();
        const emails = new Set();
        assignments.forEach(assignment => {
          if (!assignmentMatchesFacility(assignment, facilityNames)) return;
          if (!assignmentWithinWindow(assignment)) return;
          if (assignment.studentId) ids.add(String(assignment.studentId));
          if (assignment.studentSid) sids.add(String(assignment.studentSid));
          if (assignment.studentEmail) emails.add(normalizeEmail(assignment.studentEmail));
        });
        return { ids, sids, emails };
      }
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
        const schoolForProgram = (program) => {
          const token = normalizeProgramToken(program);
          if (token === 'adn' || token === 'surgtech' || token === 'respcare') return 'CPNW University';
          return 'CPNW Education';
        };
        const custom = cohortAPI
          .listCustomCohortsLegacy({ ayMin: AY_VISIBLE_MIN, ayMax: AY_VISIBLE_MAX })
          .map(c => ({ ...c, school: schoolForProgram(c.program) }));
        cohorts = cohorts.concat(custom);
      }
      const cohortFilterEl = document.getElementById('cohortFilter');
      const cohortFilterWrap = cohortFilterEl?.closest('[data-cohort-filter]');
      const cohortFilterMenu = cohortFilterWrap?.querySelector('[data-cohort-menu]');

      const baseRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
        ? window.CPNW.getSharedRoster()
        : [];
      const people = baseRoster
        .filter(person => ['student','faculty','faculty-admin'].includes(person.role))
        .map(person => ({ ...person }));

      // Include faculty + faculty-admin accounts (education-role users are intentionally excluded from this table)
      const storedAssignments = loadAssignments();
      const assignments = storedAssignments || seedAssignmentsFromPeople(people);
      if (!storedAssignments){
        saveAssignments(assignments);
      }
      const facilityNames = getHealthcareFacilityNames();
      const assignmentEligibility = buildAssignmentEligibility(assignments, facilityNames);
      const programAccess = (window.CPNW && typeof window.CPNW.getProgramAccess === 'function')
        ? window.CPNW.getProgramAccess(currentUser)
        : [];
      const accessSummary = (window.CPNW && typeof window.CPNW.getProgramAccessSummary === 'function')
        ? window.CPNW.getProgramAccessSummary(currentUser)
        : { schools: [], programsBySchool: {}, programs: [] };
      const programAccessSet = new Set(
        programAccess.map(item => `${normalize(item.school)}|${normalizeProgramToken(item.program)}`)
      );

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
      const subRadios = document.querySelectorAll('.req-submission');
      const subCompletedFields = document.getElementById('subVaccinatedFields');
      const subSeriesFields = document.getElementById('subSeriesFields');
      const subOtherFields = document.getElementById('subOtherFields');
      const submissionOptionsWrap = document.getElementById('submissionOptionsWrap');
      const reqSubmissionWrap = document.getElementById('reqSubmissionWrap');
      const reqDeclinationWrap = document.getElementById('reqDeclinationWrap');
      const reqUploadWrap = document.getElementById('reqUploadWrap');
      const subCompletedLabel = document.querySelector('label[for="subVaccinated"]');
      const subSeriesLabel = document.querySelector('label[for="subSeries"]');
      const subOtherLabel = document.querySelector('label[for="subOther"]');
      const subCompletedDateLabel = document.querySelector('label[for="vaccDate"]');
      const subSeriesStartLabel = document.querySelector('label[for="seriesStart"]');
      const subSeriesDueLabel = document.querySelector('label[for="seriesDue"]');
      const subOtherWrap = document.getElementById('subOther')?.closest('.form-check');
      const subSeriesDueWrap = document.getElementById('seriesDue')?.closest('.col-6');
      const defaultSubCompletedLabel = subCompletedLabel?.textContent || 'Vaccinated / Completed';
      const defaultSubSeriesLabel = subSeriesLabel?.textContent || 'Series in progress';
      const defaultSubOtherLabel = subOtherLabel?.textContent || 'Other';
      const defaultSubCompletedDateLabel = subCompletedDateLabel?.textContent || 'Vaccination / completion date';
      const defaultSubSeriesStartLabel = subSeriesStartLabel?.textContent || 'Series start';
      const defaultSubSeriesDueLabel = subSeriesDueLabel?.textContent || 'Next dose due';
      const varicellaSubmissionWrap = document.getElementById('varicellaSubmissionWrap');
      const varicellaRadios = document.querySelectorAll('input[name="varicellaSubmission"]');
      const varicellaOptionMilitary = document.getElementById('varicellaOptionMilitary');
      const varicellaOptionVaccination = document.getElementById('varicellaOptionVaccination');
      const varicellaOptionTiter = document.getElementById('varicellaOptionTiter');
      const varicellaVaccinationFields = document.getElementById('varicellaVaccinationFields');
      const varicellaDose1Date = document.getElementById('varicellaDose1Date');
      const varicellaDose2Date = document.getElementById('varicellaDose2Date');
      const varicellaTiterFields = document.getElementById('varicellaTiterFields');
      const varicellaTiterDate = document.getElementById('varicellaTiterDate');
      const varicellaTiterPositive = document.getElementById('varicellaTiterPositive');
      const varicellaTiterNegative = document.getElementById('varicellaTiterNegative');
      const mmrSubmissionWrap = document.getElementById('mmrSubmissionWrap');
      const mmrRadios = document.querySelectorAll('input[name="mmrSubmission"]');
      const mmrOptionMilitary = document.getElementById('mmrOptionMilitary');
      const mmrOptionVaccination = document.getElementById('mmrOptionVaccination');
      const mmrOptionTiter = document.getElementById('mmrOptionTiter');
      const mmrVaccinationFields = document.getElementById('mmrVaccinationFields');
      const mmrDose1Date = document.getElementById('mmrDose1Date');
      const mmrDose2Date = document.getElementById('mmrDose2Date');
      const mmrTiterFields = document.getElementById('mmrTiterFields');
      const mmrMeaslesGroup = mmrSubmissionWrap?.querySelector('[data-mmr-group="measles"]') || null;
      const mmrMumpsGroup = mmrSubmissionWrap?.querySelector('[data-mmr-group="mumps"]') || null;
      const mmrRubellaGroup = mmrSubmissionWrap?.querySelector('[data-mmr-group="rubella"]') || null;
      const influenzaSubmissionWrap = document.getElementById('influenzaSubmissionWrap');
      const influenzaVaccinations = document.getElementById('influenzaVaccinations');
      const influenzaAdd = document.getElementById('influenzaAdd');
      const influenzaDate0 = document.getElementById('influenzaDate0');
      const influenzaLocation0 = document.getElementById('influenzaLocation0');
      const tuberculinSubmissionWrap = document.getElementById('tuberculinSubmissionWrap');
      const tuberculinOptionTwoStep = document.getElementById('tuberculinOptionTwoStep');
      const tuberculinOptionIgra = document.getElementById('tuberculinOptionIgra');
      const tuberculinOptionHistory = document.getElementById('tuberculinOptionHistory');
      const tuberculinTwoStepFields = document.getElementById('tuberculinTwoStepFields');
      const tuberculinIgraFields = document.getElementById('tuberculinIgraFields');
      const tuberculinHistoryFields = document.getElementById('tuberculinHistoryFields');
      const tuberculinTest1Place = document.getElementById('tuberculinTest1Place');
      const tuberculinTest1Read = document.getElementById('tuberculinTest1Read');
      const tuberculinTest1Mm = document.getElementById('tuberculinTest1Mm');
      const tuberculinTest1Neg = document.getElementById('tuberculinTest1Neg');
      const tuberculinTest1Pos = document.getElementById('tuberculinTest1Pos');
      const tuberculinTest2Place = document.getElementById('tuberculinTest2Place');
      const tuberculinTest2Read = document.getElementById('tuberculinTest2Read');
      const tuberculinTest2Mm = document.getElementById('tuberculinTest2Mm');
      const tuberculinTest2Neg = document.getElementById('tuberculinTest2Neg');
      const tuberculinTest2Pos = document.getElementById('tuberculinTest2Pos');
      const tuberculinIgraDate = document.getElementById('tuberculinIgraDate');
      const tuberculinIgraNeg = document.getElementById('tuberculinIgraNeg');
      const tuberculinIgraPos = document.getElementById('tuberculinIgraPos');
      const tuberculinChestDate = document.getElementById('tuberculinChestDate');
      const tuberculinChestNeg = document.getElementById('tuberculinChestNeg');
      const tuberculinChestPos = document.getElementById('tuberculinChestPos');
      const tuberculinDownload = document.getElementById('tuberculinDownload');
      const covidSubmissionWrap = document.getElementById('covidSubmissionWrap');
      const covidNoVaccination = document.getElementById('covidNoVaccination');
      const covidDetails = document.getElementById('covidDetails');
      const covidManufacturer = document.getElementById('covidManufacturer');
      const covidDoseList = document.getElementById('covidDoseList');
      const covidDose1 = document.getElementById('covidDose1');
      const covidAddBooster = document.getElementById('covidAddBooster');
      const hepBSubmissionWrap = document.getElementById('hepBSubmissionWrap');
      const hepBOptionTiter = document.getElementById('hepBOptionTiter');
      const hepBOptionNoTiter = document.getElementById('hepBOptionNoTiter');
      const hepBTiterFields = document.getElementById('hepBTiterFields');
      const hepBTiterDate = document.getElementById('hepBTiterDate');
      const hepBTiterPositive = document.getElementById('hepBTiterPositive');
      const hepBNoTiterFields = document.getElementById('hepBNoTiterFields');
      const hepBReasonNonConverter = document.getElementById('hepBReasonNonConverter');
      const hepBReasonSeriesInProcess = document.getElementById('hepBReasonSeriesInProcess');
      const hepBReasonHistory = document.getElementById('hepBReasonHistory');
      const hepBReasonHealth = document.getElementById('hepBReasonHealth');
      const hepBNonConverterWrap = document.getElementById('hepBNonConverterWrap');
      const hepBSeriesInProcessWrap = document.getElementById('hepBSeriesInProcessWrap');
      const hepBSeriesInProcessDownload = document.getElementById('hepBSeriesInProcessDownload');
      const hepBHealthReasonWrap = document.getElementById('hepBHealthReasonWrap');
      const hepBHealthReasonInput = document.getElementById('hepBHealthReasonInput');
      const hepBHealthReasonCount = document.getElementById('hepBHealthReasonCount');
      const hepBNcSeries1Two = document.getElementById('hepBNcSeries1Two');
      const hepBNcSeries1Three = document.getElementById('hepBNcSeries1Three');
      const hepBNcSeries1TwoFields = document.getElementById('hepBNcSeries1TwoFields');
      const hepBNcSeries1ThreeFields = document.getElementById('hepBNcSeries1ThreeFields');
      const hepBNcSeries2Two = document.getElementById('hepBNcSeries2Two');
      const hepBNcSeries2Three = document.getElementById('hepBNcSeries2Three');
      const hepBNcSeries2TwoFields = document.getElementById('hepBNcSeries2TwoFields');
      const hepBNcSeries2ThreeFields = document.getElementById('hepBNcSeries2ThreeFields');
      const hepBIpSeries1Two = document.getElementById('hepBIpSeries1Two');
      const hepBIpSeries1Three = document.getElementById('hepBIpSeries1Three');
      const hepBIpSeries1TwoFields = document.getElementById('hepBIpSeries1TwoFields');
      const hepBIpSeries1ThreeFields = document.getElementById('hepBIpSeries1ThreeFields');
      let currentStatusChip = 'all';
      let reviewPage = 1;
      let reviewPageSize = Number(reviewPageSizeSelect?.value || 10);
      let sortState = { field:'', dir:'asc' };
      let influenzaExtraCount = 0;
      let covidExtraCount = 0;
      let mmrBoosterCounts = { measles: 0, mumps: 0, rubella: 0 };
      const buildMultiSelect = (window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
        ? window.CPNW.buildCheckboxMultiSelect
        : null;
      const useSeparateFilters = isHealthcareView && schoolFilter && !!buildMultiSelect;

      function getProgramsBySchool(){
        if (!isHealthcareView && Object.keys(accessSummary.programsBySchool || {}).length){
          return accessSummary.programsBySchool;
        }
        const source = isHealthcareView
          ? people.filter(p => (p.studentId && assignmentEligibility.ids.has(p.studentId))
            || assignmentEligibility.sids.has(p.sid)
            || (p.email && assignmentEligibility.emails.has(normalizeEmail(p.email))))
          : people;
        return source.reduce((acc, person) => {
          if (!person.school || !person.program) return acc;
          acc[person.school] ||= [];
          acc[person.school].push(person.program);
          return acc;
        }, {});
      }

      function handleFilterChange(){
        reviewPage = 1;
        updateCohortItems();
        renderReviews();
      }

      const schoolFilterWrap = schoolFilter?.closest('[data-school-filter]');
      const schoolFilterMenu = schoolFilterWrap?.querySelector('[data-school-menu]');
      const programFilterWrap = programFilter?.closest('[data-program-filter]');
      const programFilterMenu = programFilterWrap?.querySelector('[data-program-menu]');
      const programFilterControl = (!useSeparateFilters && window.CPNW && typeof window.CPNW.buildProgramFilter === 'function')
        ? window.CPNW.buildProgramFilter({
          input: programFilter,
          menu: programFilterMenu,
          programsBySchool: getProgramsBySchool(),
          formatProgramLabel,
          onChange: () => {
            reviewPage = 1;
            updateCohortItems();
            renderReviews();
          }
        })
        : null;

      const schoolFilterControl = (useSeparateFilters && buildMultiSelect)
        ? buildMultiSelect({
          input: schoolFilter,
          menu: schoolFilterMenu,
          items: [],
          placeholder: 'All schools',
          onChange: handleFilterChange
        })
        : null;
      const programMultiFilterControl = (useSeparateFilters && buildMultiSelect)
        ? buildMultiSelect({
          input: programFilter,
          menu: programFilterMenu,
          items: [],
          placeholder: 'All programs',
          onChange: handleFilterChange
        })
        : null;
      const cohortFilterControl = (isHealthcareView && buildMultiSelect)
        ? buildMultiSelect({
          input: cohortFilterEl,
          menu: cohortFilterMenu,
          items: [],
          placeholder: 'All cohorts',
          onChange: handleFilterChange
        })
        : null;

      function getCohortItems(programSelections = []){
        const hasProgramSelections = programSelections.length > 0;
        const filtered = cohorts.filter(c => {
          if (!hasProgramSelections) return true;
          return programSelections.some(sel =>
            normalize(sel.school) === normalize(c.school)
            && normalizeProgramToken(sel.program) === normalizeProgramToken(c.program)
          );
        });
        const items = [];
        const seen = new Set();
        items.push({ value: '__unassigned__', label: 'Unassigned', group: '' });
        filtered.forEach(c => {
          if (seen.has(c.cohortLabel)) return;
          seen.add(c.cohortLabel);
          items.push({ value: c.cohortLabel, label: c.cohortLabel, group: c.school || '' });
        });
        return items;
      }

      function updateCohortItems(){
        if (useSeparateFilters && schoolFilterControl && programMultiFilterControl && cohortFilterControl){
          const source = isHealthcareView
            ? people.filter(p => (p.studentId && assignmentEligibility.ids.has(p.studentId))
              || assignmentEligibility.sids.has(p.sid)
              || (p.email && assignmentEligibility.emails.has(normalizeEmail(p.email))))
            : people;
          const schoolItems = new Map();
          source.forEach(person => {
            const label = String(person.school || '').trim();
            if (!label) return;
            const value = normalize(label);
            if (!schoolItems.has(value)) schoolItems.set(value, label);
          });
          schoolFilterControl.setItems(Array.from(schoolItems.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label })));

          const schoolSelections = new Set(schoolFilterControl.getSelection());
          const schoolFiltered = schoolSelections.size
            ? source.filter(person => schoolSelections.has(normalize(person.school)))
            : source;

          const programItems = new Map();
          schoolFiltered.forEach(person => {
            const label = String(person.program || '').trim();
            if (!label) return;
            const value = normalizeProgramToken(label);
            if (!value) return;
            if (!programItems.has(value)) programItems.set(value, formatProgramLabel(label));
          });
          programMultiFilterControl.setItems(Array.from(programItems.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label })));

          const programSelections = new Set(programMultiFilterControl.getSelection());
          const programFiltered = programSelections.size
            ? schoolFiltered.filter(person => programSelections.has(normalizeProgramToken(person.program)))
            : schoolFiltered;

          const cohortItems = new Map();
          cohortItems.set('__unassigned__', { value: '__unassigned__', label: 'Unassigned', group: '' });
          programFiltered.forEach(person => {
            const raw = String(person.cohort || '').trim();
            const value = raw || '__unassigned__';
            if (cohortItems.has(value)) return;
            const label = raw || 'Unassigned';
            const group = formatProgramLabel(person.program || '') || '';
            cohortItems.set(value, { value, label, group });
          });
          cohortFilterControl.setItems(Array.from(cohortItems.values())
            .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)));
          return;
        }
        if (cohortFilterControl){
          const selections = programFilterControl ? programFilterControl.getSelection() : [];
          cohortFilterControl.setItems(getCohortItems(selections));
          return;
        }
        if (cohortFilterEl){
          const options = ['', '__unassigned__'];
          cohorts.forEach(c => options.push(c.cohortLabel));
          cohortFilterEl.innerHTML = options.map(opt => {
            if (!opt) return `<option value="">All cohorts</option>`;
            if (opt === '__unassigned__') return `<option value="__unassigned__">Unassigned</option>`;
            return `<option value="${opt}">${opt}</option>`;
          }).join('');
        }
      }

      updateCohortItems();

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

      function addYears(date, years){
        const d = new Date(date);
        d.setFullYear(d.getFullYear() + years);
        return d;
      }

      function seedFromPerson(person){
        const key = person?.sid || person?.email || person?.name || '';
        return Array.from(String(key)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      }

      function hasExpiringReq(person){
        const rows = buildReqs('complete', seedFromPerson(person), person.sid, person.email)
          .filter(r => r.category === 'CPNW Clinical Passport' || r.category === 'Education');
        const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
        const windowEnd = datePlusDays(30);
        return rows.some(r => {
          if (!r.expiration || !(r.expiration instanceof Date)) return false;
          const exp = new Date(r.expiration.getFullYear(), r.expiration.getMonth(), r.expiration.getDate());
          return exp < today || exp <= windowEnd;
        });
      }

      function getHealthcareReqSummary(person){
        const rows = buildReqs(
          'complete',
          seedFromPerson(person),
          person.sid,
          person.email
        ).filter(r => r.category === 'Healthcare');
        let hasReviewable = false;
        let hasExpiring = false;
        rows.forEach(r => {
          if (HEALTHCARE_REVIEWABLE_STATUSES.has(r.status)) hasReviewable = true;
          if (HEALTHCARE_EXPIRING_STATUSES.has(r.status)) hasExpiring = true;
        });
        return { hasReviewable, hasExpiring };
      }

      function getEducationReviewStatus(person){
        const rows = buildReqs(
          'complete',
          seedFromPerson(person),
          person.sid,
          person.email
        ).filter(r => r.category !== 'Healthcare' && r.type !== 'eLearning');
        const needsReview = rows.some(r => r.status === 'Submitted' || r.status === 'In Review');
        return needsReview ? 'needs-review' : '';
      }

      function isTdapRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('tetanus') && label.includes('pertussis');
      }

      function isHepBRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('hepatitis b');
      }

      function isCriminalDisclosureRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('criminal history disclosure');
      }

      function isVaricellaRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('varicella');
      }

      function isMmrRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('measles') && label.includes('mumps') && label.includes('rubella');
      }

      function isInfluenzaRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('influenza');
      }

      function isTuberculinRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('tuberculin');
      }

      function isBlsRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('bls') && label.includes('provider');
      }

      function isCovidRequirement(name){
        const label = String(name || '').toLowerCase();
        return label.includes('covid');
      }

      function buildRequirementInstructions(name){
        if (isTdapRequirement(name)){
          return [
            '<p class="fw-semibold mb-1">Instructions</p>',
            '<p class="mb-2">CPNW Tetanus, Diphtheria, Pertussis (Tdap)</p>',
            '<p>You must provide proof of receiving the Tdap vaccine (Tetanus, Diphtheria, Pertussis). After your initial Tdap dose, a Td or Tdap booster is required every 10 years to remain compliant.</p>',
            '<p class="mb-2">Vaccination Documentation:</p>',
            '<ul class="mb-0">',
            '<li>At least one documented dose of Tdap</li>',
            '<li>And, if applicable, a Td or Tdap booster if more than 10 years have passed since the initial Tdap dose</li>',
            '</ul>'
          ].join('');
        }
        if (isCriminalDisclosureRequirement(name)){
          return [
            '<p class="fw-semibold mb-1">Instructions</p>',
            '<p class="mb-2">CPNW: Criminal History Disclosure Form</p>',
            '<p>A newly completed Criminal History Disclosure form is required each year a student is in program.</p>',
            '<p>Utilize the provided document link, complete the form, and upload document to meet this requirement.</p>'
          ].join('');
        }
        if (isVaricellaRequirement(name)){
          return [
            '<p>You must meet the Varicella requirement by either providing two vaccination records or proof of immunity through a titer blood draw.</p>',
            '<p><strong>Note:</strong> A verbal or written history of having had chickenpox is not accepted as proof of immunity.</p>',
            '<p class="fw-semibold mb-1">Option 1: Vaccination Dates</p>',
            '<ul><li>Submit documentation showing two doses of the Varicella vaccine.</li></ul>',
            '<p class="fw-semibold mb-1">Option 2: Proof of Immunity by Titer</p>',
            '<ul><li>Submit a positive Varicella titer result from a blood draw.</li></ul>',
            '<p class="mb-0"><strong>Important:</strong> If the titer result is negative or non-immune, you must receive a booster dose.</p>'
          ].join('');
        }
        if (isMmrRequirement(name)){
          return [
            '<p>The MMR (Measles, Mumps, and Rubella) or MMRV (Measles, Mumps, Rubella, and Varicella) vaccine is required for clinical participation. You meet this requirement by providing vaccination records and proof of immunity through titers.</p>',
            '<p class="fw-semibold mb-1">Option 1: Vaccination</p>',
            '<p>Submit: Two doses of the MMR or MMRV vaccine.</p>',
            '<p class="fw-semibold mb-1">Option 2: Proof of Immunity by Titers</p>',
            '<p>Submit lab results showing positive titers for each of the following: Measles (Rubeola), Mumps, Rubella.</p>',
            '<p>Most labs will draw one blood sample and report three separate results (plus Varicella, if tested).</p>',
            '<p class="mb-0"><strong>Important:</strong> If any one of the three titers are negative or non-immune, you must receive a booster dose for that component.</p>'
          ].join('');
        }
        if (isInfluenzaRequirement(name)){
          return [
            '<p class="fw-semibold mb-1">CPNW Influenza (flu)</p>',
            '<p>Vaccines received prior to August 1st of the current year will expire on October 1st of the current year. Vaccines received after August 1st of the current year will expire on October 1st of the following year.</p>',
            '<p>An annual influenza vaccine is required for each current flu season, typically due by the end of September, to remain compliant for clinical participation.</p>',
            '<p class="fw-semibold mb-1">Vaccination Documentation</p>',
            '<p>Submit a record showing you received the current season’s flu vaccine.</p>',
            '<p class="mb-1">Accepted forms of vaccination include:</p>',
            '<ul>',
            '<li>Flu vaccine (injectable)</li>',
            '<li>Nasal spray flu vaccine, administered in-office by a healthcare professional</li>',
            '<li>Home/self-administered nasal spray options are not accepted.</li>',
            '</ul>',
            '<p class="mb-1">Your documentation must include:</p>',
            '<ul>',
            '<li>The date of vaccination</li>',
            '<li>Location you received the vaccination (CVS, provider’s office, clinic)</li>',
            '</ul>'
          ].join('');
        }
        if (isTuberculinRequirement(name)){
          return [
            '<p>To meet the TB requirement, you must provide proof of screening results that are no older than one year from the start date of your program.</p>',
            '<p>Proof of screening is completed by either a two-step TB skin test or a TB blood test called an Interferon Gamma Release Assays (IGRA) to confirm you do not have active tuberculosis.</p>',
            '<p class="fw-semibold mb-1">Option 1: 2-Step TB Skin Test</p>',
            '<p>The two-step TB skin test involves two separate tests administered 1–3 weeks apart, requiring a total of four office visits and approximately three weeks to complete.</p>',
            '<p class="fw-semibold mb-1">Option 2: TB Blood Test</p>',
            '<p>The TB blood test (IGRA) is a single blood draw and typically requires only one visit. It is an acceptable alternative to the skin test.</p>',
            '<p class="fw-semibold mb-1">Option 3: History of or a new positive result on either test</p>',
            '<p>You must complete a medical evaluation by a licensed healthcare provider.</p>',
            '<p>You are required to upload all applicable documentation, including provider notes, diagnostic exams, chest x-rays, and/or treatment records.</p>',
            '<p class="mb-0">If you have a history of positive TB test results, you must also complete and upload the Tuberculosis Symptom Screening form attached to this requirement.</p>'
          ].join('');
        }
        if (isBlsRequirement(name)){
          return [
            '<p>All students and faculty must maintain a current American Heart Association (AHA) BLS certification. You may meet this requirement through one of the following AHA-approved options:</p>',
            '<ul>',
            '<li>AHA BLS Provider Course (fully in-person)</li>',
            '<li>AHA HeartCode® BLS Provider Course (online + in-person skills check)</li>',
            '<li>AHA BLS Resuscitation Quality Improvement (RQI) Program</li>',
            '</ul>',
            '<p>Upload the full PDF that shows both your next RQI date and the 2-year certification date at the bottom.</p>',
            '<p class="fw-semibold mb-1">Requirements</p>',
            '<p>Each of these certification options include training in:</p>',
            '<p>Adult, child, and infant CPR, AED use, choking response, single- and multi-rescuer scenarios.</p>',
            '<p>Provide Date of Issue as shown on card or eCard.</p>',
            '<p>Upload your current course card or eCard.</p>',
            '<p class="mb-0">No other providers or courses are acceptable, outside of those mentioned above.</p>'
          ].join('');
        }
        if (isCovidRequirement(name)){
          return [
            '<p>All students and faculty are required to upload their full COVID-19 vaccination history.</p>',
            '<p>Please note: Some clinical sites may update their policies and require an annual COVID-19 vaccination/booster as a condition of participation.</p>',
            '<p class="fw-semibold mb-1">Option 1: No Vaccination History</p>',
            '<p>If you have never received a COVID-19 vaccine, check the option labeled “Not Applicable”.</p>',
            '<p class="fw-semibold mb-1">Option 2: Vaccination Documentation</p>',
            '<p>Submit all available vaccination record that includes:</p>',
            '<ul>',
            '<li>Vaccine manufacturer (e.g., Pfizer, Moderna, Johnson & Johnson)</li>',
            '<li>Dates associated with receiving either a one-dose or two-dose series</li>',
            '<li>The date(s) of administration, including subsequent boosters, if applicable</li>',
            '</ul>'
          ].join('');
        }
        return `<p>Follow the instructions to submit required proof for ${name}.</p>`;
      }

      function applySubmissionTemplate(reqName){
        const isTdap = isTdapRequirement(reqName);
        const isHepB = isHepBRequirement(reqName);
        const isVaricella = isVaricellaRequirement(reqName);
        const isMmr = isMmrRequirement(reqName);
        const isInfluenza = isInfluenzaRequirement(reqName);
        const isTuberculin = isTuberculinRequirement(reqName);
        const isBls = isBlsRequirement(reqName);
        const isCovid = isCovidRequirement(reqName);
        if (subCompletedLabel) subCompletedLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedLabel;
        if (subSeriesLabel) subSeriesLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesLabel;
        if (subOtherLabel) subOtherLabel.textContent = defaultSubOtherLabel;
        if (subCompletedDateLabel) subCompletedDateLabel.textContent = isTdap ? 'Initial Tdap date' : (isBls ? 'Date of Issue' : defaultSubCompletedDateLabel);
        if (subSeriesStartLabel) subSeriesStartLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesStartLabel;
        if (subSeriesDueLabel) subSeriesDueLabel.textContent = defaultSubSeriesDueLabel;

        const hideGeneric = isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isCovid || isBls || isTdap;
        submissionOptionsWrap?.classList.toggle('d-none', hideGeneric);

        if (isTdap){
          subCompletedFields?.classList.remove('d-none');
          subSeriesFields?.classList.remove('d-none');
          subOtherFields?.classList.add('d-none');
          subSeriesDueWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        subSeriesDueWrap?.classList.remove('d-none');

        if (isBls){
          subCompletedFields?.classList.remove('d-none');
          subSeriesFields?.classList.add('d-none');
          subOtherFields?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        if (isHepB){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetHepBFields();
          updateHepBMainOption();
          hepBSubmissionWrap?.classList.remove('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        if (isVaricella){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetVaricellaFields();
          updateVaricellaOption();
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.remove('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        if (isMmr){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetMmrFields();
          updateMmrOption();
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.remove('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        if (isInfluenza){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetInfluenzaFields();
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.remove('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        if (isTuberculin){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetTuberculinFields();
          updateTuberculinOption();
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.remove('d-none');
          covidSubmissionWrap?.classList.add('d-none');
          return;
        }

        if (isCovid){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetCovidFields();
          updateCovidOption();
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.remove('d-none');
          return;
        }

        hepBSubmissionWrap?.classList.add('d-none');
        varicellaSubmissionWrap?.classList.add('d-none');
        mmrSubmissionWrap?.classList.add('d-none');
        influenzaSubmissionWrap?.classList.add('d-none');
        tuberculinSubmissionWrap?.classList.add('d-none');
        covidSubmissionWrap?.classList.add('d-none');
      }

      function resetHepBFields(){
        if (hepBSubmissionWrap){
          const inputs = hepBSubmissionWrap.querySelectorAll('input, textarea');
          inputs.forEach(el => {
            if (el.type === 'radio' || el.type === 'checkbox'){
              el.checked = false;
            }else{
              el.value = '';
            }
          });
        }
        if (hepBHealthReasonCount) hepBHealthReasonCount.textContent = '0/200';
        hepBTiterFields?.classList.add('d-none');
        hepBNoTiterFields?.classList.add('d-none');
        hepBNonConverterWrap?.classList.add('d-none');
        hepBSeriesInProcessWrap?.classList.add('d-none');
        hepBHealthReasonWrap?.classList.add('d-none');
        [hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields].forEach(el => el?.classList.add('d-none'));
      }

      function setSeriesFields(twoFields, threeFields, isThree){
        if (!twoFields || !threeFields) return;
        twoFields.classList.toggle('d-none', !!isThree);
        threeFields.classList.toggle('d-none', !isThree);
      }

      function updateHepBMainOption(){
        const showTiter = !!hepBOptionTiter?.checked;
        const showNoTiter = !!hepBOptionNoTiter?.checked;
        hepBTiterFields?.classList.toggle('d-none', !showTiter);
        hepBNoTiterFields?.classList.toggle('d-none', !showNoTiter);
        if (!showNoTiter){
          [hepBReasonNonConverter, hepBReasonSeriesInProcess, hepBReasonHistory, hepBReasonHealth].forEach(el => {
            if (el) el.checked = false;
          });
          hepBNonConverterWrap?.classList.add('d-none');
          hepBSeriesInProcessWrap?.classList.add('d-none');
          hepBHealthReasonWrap?.classList.add('d-none');
        }
      }

      function updateHepBReason(){
        const showNonConverter = !!hepBReasonNonConverter?.checked;
        const showSeriesInProcess = !!hepBReasonSeriesInProcess?.checked;
        const showHealthReason = !!hepBReasonHealth?.checked;
        hepBNonConverterWrap?.classList.toggle('d-none', !showNonConverter);
        hepBSeriesInProcessWrap?.classList.toggle('d-none', !showSeriesInProcess);
        hepBHealthReasonWrap?.classList.toggle('d-none', !showHealthReason);
      }

      function updateHepBHealthReasonCount(){
        if (!hepBHealthReasonInput || !hepBHealthReasonCount) return;
        const len = hepBHealthReasonInput.value.length;
        hepBHealthReasonCount.textContent = `${len}/200`;
      }

      function resetVaricellaFields(){
        if (varicellaSubmissionWrap){
          const inputs = varicellaSubmissionWrap.querySelectorAll('input');
          inputs.forEach(el => {
            if (el.type === 'radio' || el.type === 'checkbox'){
              el.checked = false;
            }else{
              el.value = '';
            }
          });
        }
        varicellaVaccinationFields?.classList.add('d-none');
        varicellaTiterFields?.classList.add('d-none');
      }

      function resetMmrFields(){
        if (mmrSubmissionWrap){
          const inputs = mmrSubmissionWrap.querySelectorAll('input');
          inputs.forEach(el => {
            if (el.type === 'radio' || el.type === 'checkbox'){
              el.checked = false;
            }else{
              el.value = '';
            }
          });
        }
        const groups = [mmrMeaslesGroup, mmrMumpsGroup, mmrRubellaGroup];
        groups.forEach(group => {
          if (!group) return;
          const rows = group.querySelectorAll('[data-mmr-row]');
          rows.forEach((row, index) => {
            if (index > 0) row.remove();
          });
          updateMmrBoosterVisibility(group.dataset.mmrGroup);
        });
        mmrBoosterCounts = { measles: 0, mumps: 0, rubella: 0 };
        mmrVaccinationFields?.classList.add('d-none');
        mmrTiterFields?.classList.add('d-none');
      }

      function resetInfluenzaFields(){
        if (influenzaDate0) influenzaDate0.value = '';
        if (influenzaLocation0) influenzaLocation0.value = '';
        if (influenzaVaccinations){
          const extras = influenzaVaccinations.querySelectorAll('[data-influenza-extra]');
          extras.forEach(el => el.remove());
        }
        influenzaExtraCount = 0;
      }

      function resetTuberculinFields(){
        if (tuberculinSubmissionWrap){
          const inputs = tuberculinSubmissionWrap.querySelectorAll('input');
          inputs.forEach(el => {
            if (el.type === 'radio' || el.type === 'checkbox'){
              el.checked = false;
            }else{
              el.value = '';
            }
          });
        }
        tuberculinTwoStepFields?.classList.add('d-none');
        tuberculinIgraFields?.classList.add('d-none');
        tuberculinHistoryFields?.classList.add('d-none');
      }

      function resetCovidFields(){
        if (covidNoVaccination) covidNoVaccination.checked = false;
        if (covidManufacturer) covidManufacturer.value = '';
        if (covidDose1) covidDose1.value = '';
        if (covidDoseList){
          const extras = covidDoseList.querySelectorAll('[data-covid-extra]');
          extras.forEach(el => el.remove());
        }
        covidExtraCount = 0;
        covidDetails?.classList.remove('d-none');
      }

      function updateVaricellaOption(){
        const showVaccination = !!varicellaOptionVaccination?.checked;
        const showTiter = !!varicellaOptionTiter?.checked;
        varicellaVaccinationFields?.classList.toggle('d-none', !showVaccination);
        varicellaTiterFields?.classList.toggle('d-none', !showTiter);
      }

      function updateMmrOption(){
        const showVaccination = !!mmrOptionVaccination?.checked;
        const showTiter = !!mmrOptionTiter?.checked;
        mmrVaccinationFields?.classList.toggle('d-none', !showVaccination);
        mmrTiterFields?.classList.toggle('d-none', !showTiter);
      }

      function mmrGroupFor(type){
        if (type === 'measles') return mmrMeaslesGroup;
        if (type === 'mumps') return mmrMumpsGroup;
        if (type === 'rubella') return mmrRubellaGroup;
        return null;
      }

      function updateMmrBoosterVisibility(type){
        const group = mmrGroupFor(type);
        if (!group) return;
        const addBtn = group.querySelector('[data-mmr-add]');
        const rows = Array.from(group.querySelectorAll('[data-mmr-row]'));
        const show = rows.some(row => row.querySelector('input[type="radio"][value="neg"]')?.checked);
        if (addBtn) addBtn.classList.toggle('d-none', !show);
      }

      function addMmrBoosterRow(type){
        const group = mmrGroupFor(type);
        if (!group) return;
        const count = (mmrBoosterCounts[type] || 0) + 1;
        mmrBoosterCounts = { ...mmrBoosterCounts, [type]: count };
        const cap = type.charAt(0).toUpperCase() + type.slice(1);
        const row = document.createElement('div');
        row.className = 'row g-2 mb-2';
        row.dataset.mmrRow = 'true';
        row.innerHTML = `
          <div class="col-12 col-md-5">
            <input type="date" class="form-control" id="mmr${cap}Date${count}">
          </div>
          <div class="col-12 col-md-7">
            <div class="form-label small mb-1">Result</div>
            <div class="d-flex flex-wrap gap-3">
              <div class="form-check">
                <input class="form-check-input" type="radio" name="mmr${cap}Result${count}" id="mmr${cap}Neg${count}" value="neg">
                <label class="form-check-label" for="mmr${cap}Neg${count}">Neg/Equivalent</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="mmr${cap}Result${count}" id="mmr${cap}Pos${count}" value="pos">
                <label class="form-check-label" for="mmr${cap}Pos${count}">Pos</label>
              </div>
            </div>
          </div>
        `;
        const addBtn = group.querySelector('[data-mmr-add]');
        if (addBtn){
          group.insertBefore(row, addBtn);
        }else{
          group.appendChild(row);
        }
        updateMmrBoosterVisibility(type);
      }

      function updateTuberculinOption(){
        const showTwoStep = !!tuberculinOptionTwoStep?.checked;
        const showIgra = !!tuberculinOptionIgra?.checked;
        const showHistory = !!tuberculinOptionHistory?.checked;
        tuberculinTwoStepFields?.classList.toggle('d-none', !showTwoStep);
        tuberculinIgraFields?.classList.toggle('d-none', !showIgra);
        tuberculinHistoryFields?.classList.toggle('d-none', !showHistory);
      }

      function updateCovidOption(){
        const hideDetails = !!covidNoVaccination?.checked;
        covidDetails?.classList.toggle('d-none', hideDetails);
        if (hideDetails){
          if (covidManufacturer) covidManufacturer.value = '';
          if (covidDose1) covidDose1.value = '';
          if (covidDoseList){
            const extras = covidDoseList.querySelectorAll('[data-covid-extra]');
            extras.forEach(el => el.remove());
          }
          covidExtraCount = 0;
        }
      }

      function addInfluenzaField(){
        if (!influenzaVaccinations) return;
        influenzaExtraCount += 1;
        const dateId = `influenzaDate${influenzaExtraCount}`;
        const locationId = `influenzaLocation${influenzaExtraCount}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'col-12';
        wrapper.dataset.influenzaExtra = 'true';
        wrapper.innerHTML = `
          <div class="row g-2">
            <div class="col-12 col-md-6">
              <label class="form-label small mb-1" for="${dateId}">Vaccination date</label>
              <input type="date" class="form-control" id="${dateId}">
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label small mb-1" for="${locationId}">Location received</label>
              <input type="text" class="form-control" id="${locationId}" placeholder="Clinic or pharmacy name">
            </div>
          </div>
        `;
        influenzaVaccinations.appendChild(wrapper);
      }

      function addCovidBooster(){
        if (!covidDoseList) return;
        covidExtraCount += 1;
        const doseNumber = covidExtraCount + 1;
        const fieldId = `covidDose${doseNumber}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'col-12 col-md-6';
        wrapper.dataset.covidExtra = 'true';
        wrapper.innerHTML = `
          <label class="form-label small mb-1" for="${fieldId}">Dose ${doseNumber} date</label>
          <input type="date" class="form-control" id="${fieldId}">
        `;
        covidDoseList.appendChild(wrapper);
      }

      function setRequirementLock(locked){
        [reqSubmissionWrap, reqDeclinationWrap, reqUploadWrap].forEach(wrap => {
          if (!wrap) return;
          wrap.querySelectorAll('input, textarea, select, button').forEach(el => {
            if (el.hasAttribute('data-allow-locked')) return;
            el.disabled = locked;
          });
        });
      }

      function isImmunizationRequirement(name){
        if (!name) return false;
        return /(covid|covid-19|hepatitis|influenza|varicella|measles|mumps|rubella|mmr|tetanus|diphtheria|pertussis|tdap|tb|tuberculin|vaccine|vaccination|immunization)/i.test(name);
      }

      function buildReqs(overallStatus, seed = 0, sid = '', studentEmail = ''){
        const rows = [];
        const seedOffset = Number.isFinite(seed) ? seed : 0;
        const studentKey = requirementsStore ? requirementsStore.resolveStudentKey({ sid, email: studentEmail }) : '';
        Object.entries(reqCounts).forEach(([key,count])=>{
          for(let i=1;i<=count;i++){
            const isCPNW = key === 'cpnw';
            const isElearning = isCPNW && i <= CPNW_ELEARNING.length;
            const baseType = isElearning ? 'eLearning' : typePool[(i + count) % typePool.length];
            const frequency = isElearning ? 'Annual' : freqOptions[i % freqOptions.length];
            const category = key === 'cpnw' ? 'CPNW Clinical Passport' : key === 'ed' ? 'Education' : 'Healthcare';
            const reviewer = isElearning ? '' : reviewerPool[i % reviewerPool.length];
            let status = reqStatusPool[(i + (overallStatus === 'needs-review' ? 1 : 3) + key.length + (seedOffset % reqStatusPool.length)) % reqStatusPool.length];
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
            if (sid === '1000' && (name === 'Bloodborne Pathogens and Workplace Safety' || name === 'Chemical Hazard Communication')){
              status = 'Approved';
              exp = datePlusDays(365);
            }
            let storedRecord = null;
            if (requirementsStore && studentKey){
              storedRecord = requirementsStore.getRecord(studentKey, name);
              if (storedRecord?.status){
                status = storedRecord.status;
              }else{
                status = requirementsStore.getStatus(studentKey, name, { category, isElearning });
              }
            }
            if (sid){
              const saved = getDecisionRecord(sid, name);
              const savedStatus = decisionToStatus(saved?.decision);
              if (savedStatus && (!storedRecord || storedRecord.source === 'seed')){
                status = savedStatus;
                if (requirementsStore){
                  requirementsStore.setStatus({ sid, email: studentEmail }, name, savedStatus, {
                    source: 'decision',
                    updatedAt: saved?.savedAt || saved?.at || new Date().toISOString()
                  });
                }
                if (status === 'Approved' || status === 'Conditionally Approved'){
                  if (frequency === 'Annual' || frequency === 'Seasonal'){
                    const baseDate = saved?.at ? new Date(saved.at) : TODAY;
                    exp = addYears(baseDate, 1);
                  }else{
                    exp = null;
                  }
                }else if (status === 'Rejected'){
                  exp = null;
                }
              }
            }
            if (storedRecord?.meta?.expiration && frequency !== 'Once'
              && (status === 'Approved' || status === 'Conditionally Approved')){
              const expDate = new Date(storedRecord.meta.expiration);
              if (!Number.isNaN(expDate.getTime())) exp = expDate;
            }
            const type = !isElearning && isImmunizationRequirement(name) ? 'Immunization' : baseType;

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
          'expiring': { text:'Expiring/Expired', cls:'text-bg-danger' },
          'approved': { text:'Approved', cls:'text-bg-success' },
          'returned': { text:'Returned', cls:'text-bg-danger' }
        };
        const info = map[val] || { text: val, cls:'text-bg-secondary' };
        return `<span class="badge ${info.cls}">${info.text}</span>`;
      }

      function healthcareStatusBadge(summary){
        if (!summary) return '<span class="text-body-secondary">—</span>';
        if (summary.hasReviewable) return statusBadge('needs-review');
        if (summary.hasExpiring) return statusBadge('expiring');
        return '<span class="text-body-secondary">—</span>';
      }

      function renderReviews(){
        const q = (reviewSearch?.value || '').toLowerCase();
        const schoolSelections = useSeparateFilters && schoolFilterControl
          ? schoolFilterControl.getSelection()
          : [];
        const programSelections = useSeparateFilters
          ? (programMultiFilterControl ? programMultiFilterControl.getSelection() : [])
          : (programFilterControl ? programFilterControl.getSelection() : []);
        const hasProgramSelections = programSelections.length > 0;
        const hasSchoolSelections = schoolSelections.length > 0;
        const schoolSet = useSeparateFilters ? new Set(schoolSelections) : null;
        const programSet = useSeparateFilters ? new Set(programSelections) : null;
        const validCohorts = new Set([
          ...cohorts.map(c=>c.cohortLabel),
          ...people.map(p => p.cohort).filter(Boolean),
          '__unassigned__'
        ]);
        const cohortSelections = cohortFilterControl
          ? cohortFilterControl.getSelection().filter(val => validCohorts.has(val))
          : (cohortFilterEl && validCohorts.has(cohortFilterEl.value) && cohortFilterEl.value ? [cohortFilterEl.value] : []);
        const cohortSet = new Set(cohortSelections);
        const hasCohortSelections = cohortSet.size > 0;
        const hcSummaryCache = isHealthcareView ? new Map() : null;

        function getHcSummary(person){
          if (!isHealthcareView) return null;
          const key = person.sid || person.studentId || person.email || person.name;
          if (hcSummaryCache.has(key)) return hcSummaryCache.get(key);
          const summary = getHealthcareReqSummary(person);
          hcSummaryCache.set(key, summary);
          return summary;
        }

        function getStatusValue(person){
          if (isHealthcareView){
            const summary = getHcSummary(person);
            if (summary?.hasReviewable) return 'needs-review';
            if (summary?.hasExpiring) return 'expiring';
            return '';
          }
          return getEducationReviewStatus(person);
        }

        const filtered = people.filter(p=>{
          if (isHealthcareView){
            const matchesAssignment = (p.studentId && assignmentEligibility.ids.has(p.studentId))
              || assignmentEligibility.sids.has(p.sid)
              || (p.email && assignmentEligibility.emails.has(normalizeEmail(p.email)));
            if (!matchesAssignment) return false;
            const summary = getHcSummary(p);
            if (currentStatusChip === 'needs-review' && !summary.hasReviewable) return false;
            if (currentStatusChip === 'expiring' && !summary.hasExpiring) return false;
          }else{
            if (programAccessSet.size){
              const key = `${normalize(p.school)}|${normalizeProgramToken(p.program)}`;
              if (!programAccessSet.has(key)) return false;
            }
            if (currentStatusChip === 'expiring'){
              if (!hasExpiringReq(p)) return false;
            }else if (currentStatusChip !== 'all' && getStatusValue(p) !== currentStatusChip){
              return false;
            }
          }
          if (hasCohortSelections){
            const cohortLabel = (p.cohort || '').trim();
            const wantsUnassigned = cohortSet.has('__unassigned__');
            if (!cohortLabel){
              if (!wantsUnassigned) return false;
            }else if (!cohortSet.has(cohortLabel)){
              return false;
            }
          }
          if (useSeparateFilters){
            if (hasSchoolSelections && !schoolSet.has(normalize(p.school))) return false;
            if (hasProgramSelections && !programSet.has(normalizeProgramToken(p.program))) return false;
          }else if (hasProgramSelections){
            const matchesProgram = programSelections.some(sel =>
              normalize(sel.school) === normalize(p.school)
              && normalizeProgramToken(sel.program) === normalizeProgramToken(p.program)
            );
            if (!matchesProgram) return false;
          }
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
          const valA = (field === 'status' ? getStatusValue(a) : (a[field] ?? '')).toString().toLowerCase();
          const valB = (field === 'status' ? getStatusValue(b) : (b[field] ?? '')).toString().toLowerCase();
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
            <td>${isHealthcareView ? healthcareStatusBadge(getHcSummary(p)) : statusBadge(getStatusValue(p))}</td>
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

      [reviewSearch, cohortFilterEl].forEach(el=>{
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

      function openReviewModal(person){
        if (!person) return;
        const sid = person.sid;
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
        let reqSortKey = 'grouped';
        let reqSortDir = 'asc';
        const reqRows = buildReqs('complete', seedFromPerson(person), person.sid, person.email);
        const orderedReqs = isHealthcareView
          ? [
            ...reqRows.filter(r => r.category === 'Healthcare'),
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type !== 'eLearning'),
            ...reqRows.filter(r => r.category === 'Education'),
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type === 'eLearning')
          ]
          : [
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type !== 'eLearning'),
            ...reqRows.filter(r => r.category === 'Education'),
            ...reqRows.filter(r => r.category === 'Healthcare'),
            ...reqRows.filter(r => r.category === 'CPNW Clinical Passport' && r.type === 'eLearning')
          ];
        const reqBody = document.getElementById('reqTableBody');
        const reqTable = document.getElementById('reqTable');
        const reqSortButtons = reqTable ? reqTable.querySelectorAll('.req-sort') : [];
        const fmt = (d) => d instanceof Date ? d.toLocaleDateString() : '—';
        const reqPrev = document.getElementById('reqPrev');
        const reqNext = document.getElementById('reqNext');
        const reqPageInfo = document.getElementById('reqPageInfo');

        function getEffectiveStatus(r){
          let effectiveStatus = r.status;
          if (requirementsStore){
            const stored = requirementsStore.getStatus(
              { sid: person.sid, email: person.email },
              r.name,
              { category: r.category, isElearning: r.type === 'eLearning' }
            );
            if (stored) effectiveStatus = stored;
          }else{
            const saved = getDecisionRecord(person.sid, r.name);
            const savedStatus = decisionToStatus(saved?.decision);
            if (savedStatus) effectiveStatus = savedStatus;
          }
          if (r.type === 'eLearning' && !['Not Submitted','Approved','Expired','Expiring Soon'].includes(effectiveStatus)){
            effectiveStatus = 'Not Submitted';
          }
          return effectiveStatus;
        }

        function compareValues(a, b){
          if (a == null && b == null) return 0;
          if (a == null) return 1;
          if (b == null) return -1;
          if (a instanceof Date && b instanceof Date) return a - b;
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        }

        function updateSortIndicators(){
          if (!reqTable) return;
          reqTable.querySelectorAll('th').forEach(th=>{
            const btn = th.querySelector('.req-sort');
            const key = btn?.dataset?.sort;
            if (!key) return;
            if (key === reqSortKey){
              th.setAttribute('aria-sort', reqSortDir === 'asc' ? 'ascending' : 'descending');
            } else {
              th.setAttribute('aria-sort', 'none');
            }
          });
        }

        function renderReqs(){
          const total = orderedReqs.length;
          const totalPages = Math.max(1, Math.ceil(total / reqPageSize));
          if (reqPage > totalPages) reqPage = totalPages;
          const start = (reqPage - 1) * reqPageSize;
          const end = Math.min(start + reqPageSize, total);
          const groupRank = isHealthcareView
            ? {
              'Healthcare': 0,
              'CPNW Clinical Passport': 1,
              'Education': 2
            }
            : {
              'CPNW Clinical Passport': 0,
              'Education': 1,
              'Healthcare': 2
            };
          const sortMap = {
            grouped: (r) => r,
            name: (r) => r.name,
            status: (r) => getEffectiveStatus(r),
            expiration: (r) => r.expiration,
            type: (r) => r.type,
            frequency: (r) => r.frequency,
            category: (r) => r.category,
            reviewer: (r) => r.reviewer
          };
          const sortFn = sortMap[reqSortKey] || sortMap.name;
          const sortedReqs = [...orderedReqs].sort((a, b)=>{
            if (reqSortKey === 'grouped'){
              const aRank = a.type === 'eLearning' ? 3 : (groupRank[a.category] ?? 3);
              const bRank = b.type === 'eLearning' ? 3 : (groupRank[b.category] ?? 3);
              const groupResult = aRank - bRank;
              if (groupResult !== 0) return reqSortDir === 'asc' ? groupResult : -groupResult;
              const nameResult = compareValues(a.name, b.name);
              return reqSortDir === 'asc' ? nameResult : -nameResult;
            }
            const result = compareValues(sortFn(a), sortFn(b));
            return reqSortDir === 'asc' ? result : -result;
          });
          const pageItems = sortedReqs.slice(start, end);
	        reqBody.innerHTML = pageItems.map((r, idx)=>{
	          const effectiveStatus = getEffectiveStatus(r);
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
          const abbr = r.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,6);
          const requiredBy = r.category === 'CPNW Clinical Passport' ? 'CPNW' : r.category === 'Education' ? 'Education' : 'CPNW Healthcare Facility';
          const nameCell = r.type === 'eLearning'
            ? `<span class="text-body-secondary text-start">${r.name}</span>`
            : `<button class="btn btn-link p-0 text-decoration-none text-start req-detail-btn" data-req-detail="1" data-req-index="${start + idx}" data-req-name="${r.name}" data-req-abbr="${abbr}" data-req-requiredby="${requiredBy}" data-req-category="${r.category}">${r.name}</button>`;
          return `
            <tr>
              <td class="text-start">${nameCell}</td>
              <td>${statusBadge}</td>
              <td>${fmt(r.expiration)}</td>
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

        reqSortButtons.forEach(btn=>{
          btn.addEventListener('click', () => {
            const key = btn.dataset.sort;
            if (!key) return;
            if (reqSortKey === key){
              reqSortDir = reqSortDir === 'asc' ? 'desc' : 'asc';
            } else {
              reqSortKey = key;
              reqSortDir = 'asc';
            }
            reqPage = 1;
            updateSortIndicators();
            renderReqs();
          });
        });
        updateSortIndicators();

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
        currentReqContext = { sid: person.sid, reqName: '', rerenderReqs: renderReqs, email: person.email };
      }

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
        const instructions = buildRequirementInstructions(name);
        const category = btn.dataset.reqCategory || '';
        const student = btn.closest('#reviewModal')?.dataset?.studentName || document.getElementById('reqDetailStudent')?.textContent || '';
        const sid = btn.closest('#reviewModal')?.dataset?.studentSid || '';
        const studentEmail = btn.closest('#reviewModal')?.dataset?.studentEmail || '';
        document.getElementById('reqDetailStudent').textContent = student;
        const studentEmailEl = document.getElementById('reqDetailStudentEmail');
        if (studentEmailEl) studentEmailEl.textContent = studentEmail;
        document.getElementById('reqDetailModalLabel').textContent = name;
	        document.getElementById('reqDetailMeta').textContent = `Abbreviation: ${abbr} • Required by: ${requiredBy}`;
	        const instructionsEl = document.getElementById('reqDetailInstructions');
        if (instructionsEl) instructionsEl.innerHTML = instructions;
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
        resetHepBFields();
        resetVaricellaFields();
        resetMmrFields();
        resetInfluenzaFields();
        resetTuberculinFields();
        resetCovidFields();
        applySubmissionTemplate(name);

	        const decisionWrap = document.getElementById('reqDecisionSave')?.closest('.mb-3');
	        let decisionNote = document.getElementById('decisionRestrictionNote');
	        if (!decisionNote && decisionWrap){
	          decisionNote = document.createElement('div');
	          decisionNote.id = 'decisionRestrictionNote';
	          decisionNote.className = 'small text-body-secondary mt-2 d-none';
	          decisionNote.textContent = 'Healthcare users can only review Healthcare requirements.';
	          decisionWrap.appendChild(decisionNote);
	        }
	        const canReview = isHealthcareView ? category === 'Healthcare' : category !== 'Healthcare';
	        const lockDecisions = !canReview;
	        if (decisionNote){
	          decisionNote.textContent = isHealthcareView
	            ? 'Healthcare users can only review Healthcare requirements.'
	            : 'Education users can only review CPNW and Education requirements.';
	        }
	        document.querySelectorAll('.decision-radio').forEach(r=>r.disabled = lockDecisions);
	        const decisionReason = document.getElementById('decisionReason');
	        if (decisionReason) decisionReason.disabled = lockDecisions;
	        const decisionSave = document.getElementById('reqDecisionSave');
	        if (decisionSave) decisionSave.disabled = lockDecisions;
	        if (decisionNote) decisionNote.classList.toggle('d-none', !lockDecisions);
	        setRequirementLock(lockDecisions);

	        // Load saved decision if present
	        if (sid){
	          const saved = getDecisionRecord(sid, name);
	          if (saved){
	            const savedSubmission = saved.submission || null;
	            const isCustomSubmission = isVaricellaRequirement(name)
	              || isHepBRequirement(name)
	              || isMmrRequirement(name)
	              || isInfluenzaRequirement(name)
	              || isTuberculinRequirement(name)
	              || isCovidRequirement(name)
	              || isBlsRequirement(name)
	              || isTdapRequirement(name);
	            if (savedSubmission?.type && !isCustomSubmission){
	              const subEl = document.getElementById(savedSubmission.type);
	              if (subEl){
	                subEl.checked = true;
	                document.querySelectorAll('.req-submission-fields').forEach(el=>el.classList.add('d-none'));
	                const targetId = subEl.dataset.target;
	                if (targetId){
	                  document.getElementById(targetId)?.classList.remove('d-none');
	                }
	              }
	            }
	            if (vaccDate) vaccDate.value = savedSubmission?.vaccDate || '';
	            if (seriesStart) seriesStart.value = savedSubmission?.seriesStart || '';
	            if (seriesDue) seriesDue.value = savedSubmission?.seriesDue || '';
	            if (otherNotes) otherNotes.value = savedSubmission?.otherNotes || '';

	            if (savedSubmission?.hepB){
	              resetHepBFields();
	              if (savedSubmission.hepB.mainOption === 'titer'){
	                hepBOptionTiter.checked = true;
	                updateHepBMainOption();
	              }else if (savedSubmission.hepB.mainOption === 'notiter'){
	                hepBOptionNoTiter.checked = true;
	                updateHepBMainOption();
	              }
	              if (hepBTiterDate) hepBTiterDate.value = savedSubmission.hepB.titerDate || '';
	              if (hepBTiterPositive) hepBTiterPositive.checked = !!savedSubmission.hepB.titerPositive;
	              const reason = savedSubmission.hepB.noTiterReason || '';
	              if (reason === 'nonconverter') hepBReasonNonConverter.checked = true;
	              if (reason === 'inprocess') hepBReasonSeriesInProcess.checked = true;
	              if (reason === 'history') hepBReasonHistory.checked = true;
	              if (reason === 'health') hepBReasonHealth.checked = true;
	              updateHepBReason();
	              if (hepBHealthReasonInput) hepBHealthReasonInput.value = savedSubmission.hepB.healthReason || '';
	              updateHepBHealthReasonCount();
	              if (savedSubmission.hepB.series){
	                setSeriesFields(hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, savedSubmission.hepB.series.ncSeries1Steps === 3);
	                setSeriesFields(hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, savedSubmission.hepB.series.ncSeries2Steps === 3);
	                setSeriesFields(hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields, savedSubmission.hepB.series.ipSeries1Steps === 3);
	                if (savedSubmission.hepB.series.ncSeries1Steps === 2) hepBNcSeries1Two.checked = true;
	                if (savedSubmission.hepB.series.ncSeries1Steps === 3) hepBNcSeries1Three.checked = true;
	                if (savedSubmission.hepB.series.ncSeries2Steps === 2) hepBNcSeries2Two.checked = true;
	                if (savedSubmission.hepB.series.ncSeries2Steps === 3) hepBNcSeries2Three.checked = true;
	                if (savedSubmission.hepB.series.ipSeries1Steps === 2) hepBIpSeries1Two.checked = true;
	                if (savedSubmission.hepB.series.ipSeries1Steps === 3) hepBIpSeries1Three.checked = true;
	              }
	            }

	            if (savedSubmission?.varicella){
	              resetVaricellaFields();
	              if (savedSubmission.varicella.option === 'military') varicellaOptionMilitary.checked = true;
	              if (savedSubmission.varicella.option === 'vaccination') varicellaOptionVaccination.checked = true;
	              if (savedSubmission.varicella.option === 'titer') varicellaOptionTiter.checked = true;
	              updateVaricellaOption();
	              if (varicellaDose1Date) varicellaDose1Date.value = savedSubmission.varicella.vaccinationDates?.[0] || '';
	              if (varicellaDose2Date) varicellaDose2Date.value = savedSubmission.varicella.vaccinationDates?.[1] || '';
	              if (varicellaTiterDate) varicellaTiterDate.value = savedSubmission.varicella.titerDate || '';
	              if (savedSubmission.varicella.titerResult === 'positive') varicellaTiterPositive.checked = true;
	              if (savedSubmission.varicella.titerResult === 'negative') varicellaTiterNegative.checked = true;
	            }

	            if (savedSubmission?.mmr){
	              resetMmrFields();
	              if (savedSubmission.mmr.option === 'military') mmrOptionMilitary.checked = true;
	              if (savedSubmission.mmr.option === 'vaccination') mmrOptionVaccination.checked = true;
	              if (savedSubmission.mmr.option === 'titer') mmrOptionTiter.checked = true;
	              updateMmrOption();
	              if (mmrDose1Date) mmrDose1Date.value = savedSubmission.mmr.vaccinationDates?.[0] || '';
	              if (mmrDose2Date) mmrDose2Date.value = savedSubmission.mmr.vaccinationDates?.[1] || '';
	              const applyMmrRows = (type, rows) => {
	                if (!Array.isArray(rows)) return;
	                rows.forEach((row, index) => {
	                  if (index > 0) addMmrBoosterRow(type);
	                  const group = mmrGroupFor(type);
	                  const targetRow = group?.querySelectorAll('[data-mmr-row]')?.[index];
	                  if (!targetRow) return;
	                  const dateInput = targetRow.querySelector('input[type="date"]');
	                  if (dateInput) dateInput.value = row.date || '';
	                  if (row.result){
	                    const resRadio = targetRow.querySelector(`input[type="radio"][value="${row.result}"]`);
	                    if (resRadio) resRadio.checked = true;
	                  }
	                });
	                updateMmrBoosterVisibility(type);
	              };
	              applyMmrRows('measles', savedSubmission.mmr.titers?.measles || []);
	              applyMmrRows('mumps', savedSubmission.mmr.titers?.mumps || []);
	              applyMmrRows('rubella', savedSubmission.mmr.titers?.rubella || []);
	            }

	            if (savedSubmission?.influenza){
	              resetInfluenzaFields();
	              const vaccinations = savedSubmission.influenza.vaccinations || [];
	              vaccinations.forEach((entry, index) => {
	                if (index > 0) addInfluenzaField();
	                const rows = influenzaVaccinations?.querySelectorAll('[data-influenza-entry], [data-influenza-extra]');
	                const row = rows?.[index];
	                if (!row) return;
	                const dateInput = row.querySelector('input[type="date"]');
	                const locationInput = row.querySelector('input[type="text"]');
	                if (dateInput) dateInput.value = entry.date || '';
	                if (locationInput) locationInput.value = entry.location || '';
	              });
	            }

	            if (savedSubmission?.tuberculin){
	              resetTuberculinFields();
	              if (savedSubmission.tuberculin.option === 'two_step') tuberculinOptionTwoStep.checked = true;
	              if (savedSubmission.tuberculin.option === 'igra') tuberculinOptionIgra.checked = true;
	              if (savedSubmission.tuberculin.option === 'history') tuberculinOptionHistory.checked = true;
	              updateTuberculinOption();
	              if (tuberculinTest1Place) tuberculinTest1Place.value = savedSubmission.tuberculin.twoStep?.test1?.placeDate || '';
	              if (tuberculinTest1Read) tuberculinTest1Read.value = savedSubmission.tuberculin.twoStep?.test1?.readDate || '';
	              if (tuberculinTest1Mm) tuberculinTest1Mm.value = savedSubmission.tuberculin.twoStep?.test1?.resultMm || '';
	              if (savedSubmission.tuberculin.twoStep?.test1?.result === 'neg') tuberculinTest1Neg.checked = true;
	              if (savedSubmission.tuberculin.twoStep?.test1?.result === 'pos') tuberculinTest1Pos.checked = true;
	              if (tuberculinTest2Place) tuberculinTest2Place.value = savedSubmission.tuberculin.twoStep?.test2?.placeDate || '';
	              if (tuberculinTest2Read) tuberculinTest2Read.value = savedSubmission.tuberculin.twoStep?.test2?.readDate || '';
	              if (tuberculinTest2Mm) tuberculinTest2Mm.value = savedSubmission.tuberculin.twoStep?.test2?.resultMm || '';
	              if (savedSubmission.tuberculin.twoStep?.test2?.result === 'neg') tuberculinTest2Neg.checked = true;
	              if (savedSubmission.tuberculin.twoStep?.test2?.result === 'pos') tuberculinTest2Pos.checked = true;
	              if (tuberculinIgraDate) tuberculinIgraDate.value = savedSubmission.tuberculin.igra?.dateDrawn || '';
	              if (savedSubmission.tuberculin.igra?.result === 'neg') tuberculinIgraNeg.checked = true;
	              if (savedSubmission.tuberculin.igra?.result === 'pos') tuberculinIgraPos.checked = true;
	              if (tuberculinChestDate) tuberculinChestDate.value = savedSubmission.tuberculin.history?.chestDate || '';
	              if (savedSubmission.tuberculin.history?.result === 'neg') tuberculinChestNeg.checked = true;
	              if (savedSubmission.tuberculin.history?.result === 'pos') tuberculinChestPos.checked = true;
	            }

	            if (savedSubmission?.covid){
	              resetCovidFields();
	              covidNoVaccination.checked = !!savedSubmission.covid.noVaccination;
	              if (covidManufacturer) covidManufacturer.value = savedSubmission.covid.manufacturer || '';
	              updateCovidOption();
	              const doses = savedSubmission.covid.doses || [];
	              doses.forEach((dose, index) => {
	                if (index > 0) addCovidBooster();
	                const inputs = covidDoseList?.querySelectorAll('input[type="date"]') || [];
	                const input = inputs[index];
	                if (input) input.value = dose || '';
	              });
	            }

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
	        currentReqContext = { ...currentReqContext, sid, reqName: name, category };

	        window.__reviewWasOpen = reviewModalEl?.classList.contains('show');
        if (window.__reviewWasOpen && reviewModalInstance){
          reviewModalInstance.hide();
        }
        currentReqThreadKey = name;
        currentReplyThreadIndex = null;
        renderThread();
        reqModal.show();
      });

      document.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-review]');
        if (!btn) return;
        const sid = btn.dataset.review;
        const person = people.find(p=>p.sid === sid);
        if (!person) return;
        openReviewModal(person);
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

      [hepBOptionTiter, hepBOptionNoTiter].forEach(el => el?.addEventListener('change', updateHepBMainOption));
      [hepBReasonNonConverter, hepBReasonSeriesInProcess, hepBReasonHistory, hepBReasonHealth].forEach(el => el?.addEventListener('change', updateHepBReason));
      [hepBNcSeries1Two, hepBNcSeries1Three].forEach(el => el?.addEventListener('change', () => {
        setSeriesFields(hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, hepBNcSeries1Three?.checked);
      }));
      [hepBNcSeries2Two, hepBNcSeries2Three].forEach(el => el?.addEventListener('change', () => {
        setSeriesFields(hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, hepBNcSeries2Three?.checked);
      }));
      [hepBIpSeries1Two, hepBIpSeries1Three].forEach(el => el?.addEventListener('change', () => {
        setSeriesFields(hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields, hepBIpSeries1Three?.checked);
      }));
      hepBHealthReasonInput?.addEventListener('input', updateHepBHealthReasonCount);
      hepBSeriesInProcessDownload?.addEventListener('click', downloadSeriesInProcessForm);
      varicellaOptionMilitary?.addEventListener('change', updateVaricellaOption);
      varicellaOptionVaccination?.addEventListener('change', updateVaricellaOption);
      varicellaOptionTiter?.addEventListener('change', updateVaricellaOption);
      mmrOptionMilitary?.addEventListener('change', updateMmrOption);
      mmrOptionVaccination?.addEventListener('change', updateMmrOption);
      mmrOptionTiter?.addEventListener('change', updateMmrOption);
      [
        { type: 'measles', group: mmrMeaslesGroup },
        { type: 'mumps', group: mmrMumpsGroup },
        { type: 'rubella', group: mmrRubellaGroup }
      ].forEach(({ type, group }) => {
        group?.querySelector('[data-mmr-add]')?.addEventListener('click', () => addMmrBoosterRow(type));
        group?.addEventListener('change', (event) => {
          if (!event.target.matches('input[type="radio"]')) return;
          updateMmrBoosterVisibility(type);
        });
      });
      influenzaAdd?.addEventListener('click', addInfluenzaField);
      tuberculinOptionTwoStep?.addEventListener('change', updateTuberculinOption);
      tuberculinOptionIgra?.addEventListener('change', updateTuberculinOption);
      tuberculinOptionHistory?.addEventListener('change', updateTuberculinOption);
      tuberculinDownload?.addEventListener('click', downloadTuberculinForm);
      covidNoVaccination?.addEventListener('change', updateCovidOption);
      covidAddBooster?.addEventListener('click', addCovidBooster);

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

        const canReview = isHealthcareView
          ? currentReqContext?.category === 'Healthcare'
          : currentReqContext?.category !== 'Healthcare';
        if (!canReview){
          alert(isHealthcareView
            ? 'Healthcare users can only review Healthcare requirements.'
            : 'Education users can only review CPNW and Education requirements.');
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
        const currentReqName = reqName;
        const influenzaEntries = isInfluenzaRequirement(currentReqName) && influenzaVaccinations
          ? Array.from(influenzaVaccinations.querySelectorAll('[data-influenza-entry], [data-influenza-extra]'))
            .map(row => ({
              date: row.querySelector('input[type="date"]')?.value || '',
              location: row.querySelector('input[type="text"]')?.value || ''
            }))
            .filter(entry => entry.date || entry.location)
          : [];
        const covidEntries = isCovidRequirement(currentReqName) && covidDoseList
          ? Array.from(covidDoseList.querySelectorAll('input[type="date"]'))
            .map(input => input.value)
            .filter(Boolean)
          : [];
        const mmrRowsFor = (type) => {
          const group = mmrGroupFor(type);
          if (!group) return [];
          return Array.from(group.querySelectorAll('[data-mmr-row]'))
            .map(row => {
              const date = row.querySelector('input[type="date"]')?.value || '';
              const result = row.querySelector('input[type="radio"]:checked')?.value || '';
              return date || result ? { date, result } : null;
            })
            .filter(Boolean);
        };

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
            otherNotes: (document.getElementById('otherNotes')?.value || '').trim(),
            hepB: isHepBRequirement(currentReqName) ? {
              mainOption: hepBOptionTiter?.checked ? 'titer' : (hepBOptionNoTiter?.checked ? 'notiter' : ''),
              titerDate: hepBTiterDate?.value || '',
              titerPositive: !!hepBTiterPositive?.checked,
              noTiterReason: hepBReasonNonConverter?.checked
                ? 'nonconverter'
                : (hepBReasonSeriesInProcess?.checked
                  ? 'inprocess'
                  : (hepBReasonHistory?.checked ? 'history' : (hepBReasonHealth?.checked ? 'health' : ''))),
              healthReason: hepBHealthReasonInput?.value || '',
              series: {
                ncSeries1Steps: hepBNcSeries1Two?.checked ? 2 : (hepBNcSeries1Three?.checked ? 3 : 0),
                ncSeries2Steps: hepBNcSeries2Two?.checked ? 2 : (hepBNcSeries2Three?.checked ? 3 : 0),
                ipSeries1Steps: hepBIpSeries1Two?.checked ? 2 : (hepBIpSeries1Three?.checked ? 3 : 0)
              }
            } : null,
            varicella: isVaricellaRequirement(currentReqName) ? {
              option: Array.from(varicellaRadios).find(r => r.checked)?.value || '',
              vaccinationDates: [varicellaDose1Date?.value || '', varicellaDose2Date?.value || ''].filter(Boolean),
              titerDate: varicellaTiterDate?.value || '',
              titerResult: varicellaTiterPositive?.checked ? 'positive' : (varicellaTiterNegative?.checked ? 'negative' : '')
            } : null,
            mmr: isMmrRequirement(currentReqName) ? {
              option: Array.from(mmrRadios).find(r => r.checked)?.value || '',
              vaccinationDates: [mmrDose1Date?.value || '', mmrDose2Date?.value || ''].filter(Boolean),
              titers: {
                measles: mmrRowsFor('measles'),
                mumps: mmrRowsFor('mumps'),
                rubella: mmrRowsFor('rubella')
              }
            } : null,
            influenza: isInfluenzaRequirement(currentReqName) ? {
              vaccinations: influenzaEntries
            } : null,
            tuberculin: isTuberculinRequirement(currentReqName) ? {
              option: tuberculinOptionTwoStep?.checked
                ? 'two_step'
                : (tuberculinOptionIgra?.checked ? 'igra' : (tuberculinOptionHistory?.checked ? 'history' : '')),
              twoStep: {
                test1: {
                  placeDate: tuberculinTest1Place?.value || '',
                  readDate: tuberculinTest1Read?.value || '',
                  resultMm: tuberculinTest1Mm?.value || '',
                  result: tuberculinTest1Neg?.checked ? 'neg' : (tuberculinTest1Pos?.checked ? 'pos' : '')
                },
                test2: {
                  placeDate: tuberculinTest2Place?.value || '',
                  readDate: tuberculinTest2Read?.value || '',
                  resultMm: tuberculinTest2Mm?.value || '',
                  result: tuberculinTest2Neg?.checked ? 'neg' : (tuberculinTest2Pos?.checked ? 'pos' : '')
                }
              },
              igra: {
                dateDrawn: tuberculinIgraDate?.value || '',
                result: tuberculinIgraNeg?.checked ? 'neg' : (tuberculinIgraPos?.checked ? 'pos' : '')
              },
              history: {
                chestDate: tuberculinChestDate?.value || '',
                result: tuberculinChestNeg?.checked ? 'neg' : (tuberculinChestPos?.checked ? 'pos' : '')
              }
            } : null,
            covid: isCovidRequirement(currentReqName) ? {
              noVaccination: !!covidNoVaccination?.checked,
              manufacturer: (covidManufacturer?.value || '').trim(),
              doses: covidEntries
            } : null
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
        if (requirementsStore && decision){
          requirementsStore.setDecision(
            { sid, email: currentReqContext?.email || '' },
            reqName,
            decision,
            { source: 'decision', updatedAt: record.savedAt }
          );
        }
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

      document.addEventListener('click', (e)=>{
        const downloadBtn = e.target.closest('[data-download-file]');
        if (!downloadBtn) return;
        const name = decodeURIComponent(downloadBtn.dataset.downloadFile || '');
        if (!name) return;
        downloadUploadedFile(name);
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

      if (isHealthcareView){
        const sidParam = new URLSearchParams(window.location.search).get('sid');
        if (sidParam){
          const person = people.find(p => String(p.sid) === String(sidParam));
          if (person) openReviewModal(person);
        }
      }
    })();
  
