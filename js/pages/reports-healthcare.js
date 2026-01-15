
    (function(){
      const TODAY = new Date();
      const FALL_START_MONTH = 7;
      const CURRENT_AY_START = TODAY.getMonth() >= FALL_START_MONTH ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
      const AY_VISIBLE_MIN = CURRENT_AY_START - 3;
      const AY_VISIBLE_MAX = CURRENT_AY_START + 1;
      const TERMS = ['Fall','Winter','Spring','Summer'];
      const isHealthcareView = window.location.pathname.includes('/healthcare-views/');
      const currentUser = (() => {
        try{
          return JSON.parse(localStorage.getItem('cpnw-current-user') || 'null');
        }catch(err){
          return null;
        }
      })();
      const canDeleteDocs = !!currentUser?.permissions?.canDelete;
      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
      const currentPrograms = Array.isArray(currentUser?.programs)
        ? currentUser.programs
        : currentUser?.programs ? [currentUser.programs] : [];
      const accessPrograms = (window.CPNW && typeof window.CPNW.getProgramAccessPrograms === 'function')
        ? window.CPNW.getProgramAccessPrograms(currentUser)
        : currentPrograms;
      const accessSummary = (window.CPNW && typeof window.CPNW.getProgramAccessSummary === 'function')
        ? window.CPNW.getProgramAccessSummary(currentUser)
        : { schools: [], programsBySchool: {}, programs: accessPrograms };
      const allowedPrograms = accessPrograms.map(p => String(p || '').toLowerCase());
      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';
      const ASSIGNMENT_WINDOW_DAYS = 42;
      const ASSIGNMENT_GRACE_DAYS = 14;

      function normalizeProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'surg tech';
        if (name.includes('rad')) return 'radiologic technology';
        if (name.includes('resp')) return 'respiratory care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'diagnostic medical sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'medical assistant';
        if (name.includes('bsn')) return 'bsn';
        if (name.includes('adn')) return 'adn';
        return name;
      }

      function formatProgramLabel(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('resp')) return 'Respiratory Care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'Diagnostic Medical Sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'Medical Assistant';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return String(label || '').trim();
      }

      function normalizeSchool(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalize(value){
        return String(value || '').trim().toLowerCase();
      }

      function normalizeEmail(value){
        return String(value || '').trim().toLowerCase();
      }

      function hydrateAssignments(list){
        if (!Array.isArray(list)) return [];
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
        try{
          const raw = localStorage.getItem(ASSIGNMENTS_KEY);
          if (!raw) return [];
          return hydrateAssignments(JSON.parse(raw));
        }catch{
          return [];
        }
      }

      function saveAssignments(list){
        try{
          localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(serializeAssignments(list)));
        }catch{
          // ignore
        }
      }

      function formatShortDate(date){
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' });
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

      function getHealthcareFacilityLabels(){
        if (!currentUser?.permissions?.canCoordinate) return [];
        const names = [
          currentUser.profile?.program,
          currentUser.profile?.school,
          ...(currentUser.programs || []),
          ...(currentUser.schools || [])
        ];
        const unique = new Map();
        names.forEach(name => {
          const label = String(name || '').trim();
          const key = normalize(label);
          if (!label || unique.has(key)) return;
          unique.set(key, label);
        });
        return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
      }

      const facilityNames = getHealthcareFacilityNames();
      const facilityLabels = getHealthcareFacilityLabels();

      function isFacilityName(value){
        return facilityNames.has(normalize(value));
      }

      function getFallbackSchools(){
        const accessSchools = (accessSummary.schools || [])
          .map(school => String(school || '').trim())
          .filter(Boolean)
          .filter(school => !isFacilityName(school));
        if (accessSchools.length) return accessSchools;
        const roster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
          ? window.CPNW.getSharedRoster()
          : [];
        const rosterSchools = Array.from(new Set(
          roster
            .map(entry => String(entry.school || '').trim())
            .filter(Boolean)
            .filter(school => !isFacilityName(school))
        ));
        if (rosterSchools.length) return rosterSchools;
        return ['CPNW Education', 'CPNW University'];
      }

      const fallbackSchools = getFallbackSchools();

      function sanitizeSchool(value){
        const label = String(value || '').trim();
        if (!label || isFacilityName(label)){
          return fallbackSchools[0] || 'CPNW Education';
        }
        return label;
      }

      function buildAssignmentLocationMap(assignments, facilityNames){
        const map = new Map();
        (assignments || []).forEach(assignment => {
          if (!assignmentWithinWindow(assignment)) return;
          if (facilityNames?.size && !assignmentMatchesFacility(assignment, facilityNames)) return;
          const location = String(assignment.location || '').trim();
          if (!location) return;
          const keys = [];
          if (assignment.studentId) keys.push(`id:${assignment.studentId}`);
          if (assignment.studentSid) keys.push(`sid:${assignment.studentSid}`);
          if (assignment.studentEmail) keys.push(`email:${normalizeEmail(assignment.studentEmail)}`);
          keys.forEach(key => {
            if (!map.has(key)) map.set(key, new Set());
            map.get(key).add(location);
          });
        });
        return map;
      }

      function buildAssignmentLookup(assignments, facilityNames){
        const map = new Map();
        (assignments || []).forEach(assignment => {
          if (!assignmentWithinWindow(assignment)) return;
          if (facilityNames?.size && !assignmentMatchesFacility(assignment, facilityNames)) return;
          const keys = [];
          if (assignment.studentId) keys.push(`id:${assignment.studentId}`);
          if (assignment.studentSid) keys.push(`sid:${assignment.studentSid}`);
          if (assignment.studentEmail) keys.push(`email:${normalizeEmail(assignment.studentEmail)}`);
          keys.forEach(key => {
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(assignment);
          });
        });
        return map;
      }

      function assignmentMatchesFacility(assignment, facilityNames){
        if (!facilityNames.size) return false;
        return facilityNames.has(normalize(assignment?.location));
      }

      function assignmentWithinWindow(assignment){
        const start = assignment?.start instanceof Date ? assignment.start : (assignment?.start ? new Date(assignment.start) : null);
        const end = assignment?.end instanceof Date ? assignment.end : (assignment?.end ? new Date(assignment.end) : null);
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
        if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;
        const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const upcomingLimit = new Date(today);
        upcomingLimit.setDate(upcomingLimit.getDate() + ASSIGNMENT_WINDOW_DAYS);
        const endLimit = new Date(endDay);
        endLimit.setDate(endLimit.getDate() + ASSIGNMENT_GRACE_DAYS);
        const startsSoon = startDay >= today && startDay <= upcomingLimit;
        const activeOrRecent = startDay <= today && endLimit >= today;
        return startsSoon || activeOrRecent;
      }

      function buildHealthcareEligibility(assignments, facilityNames){
        const ids = new Set();
        const sids = new Set();
        const emails = new Set();
        (assignments || []).forEach(assignment => {
          if (!assignmentMatchesFacility(assignment, facilityNames)) return;
          if (!assignmentWithinWindow(assignment)) return;
          if (assignment.studentId) ids.add(String(assignment.studentId));
          if (assignment.studentSid) sids.add(String(assignment.studentSid));
          if (assignment.studentEmail) emails.add(normalizeEmail(assignment.studentEmail));
        });
        return { ids, sids, emails };
      }

      const programToSchools = new Map();
      Object.entries(accessSummary.programsBySchool || {}).forEach(([school, programs]) => {
        if (isFacilityName(school)) return;
        programs.forEach(program => {
          const key = normalizeProgramLabel(program);
          if (!programToSchools.has(key)) programToSchools.set(key, []);
          const list = programToSchools.get(key);
          if (!list.includes(school)) list.push(school);
        });
      });
      const programSchoolCursor = new Map();
      function pickSchoolForProgram(program){
        const key = normalizeProgramLabel(program);
        const schools = programToSchools.get(key);
        const idx = programSchoolCursor.get(key) || 0;
        programSchoolCursor.set(key, idx + 1);
        if (schools && schools.length){
          return sanitizeSchool(schools[idx % schools.length]);
        }
        const fallback = fallbackSchools.length ? fallbackSchools : ['CPNW Education'];
        return sanitizeSchool(fallback[idx % fallback.length]);
      }
      const programAccessSet = new Set();
      Object.entries(accessSummary.programsBySchool || {}).forEach(([school, programs]) => {
        if (isFacilityName(school)) return;
        programs.forEach(program => {
          programAccessSet.add(`${normalizeSchool(school)}|${normalizeProgramLabel(program)}`);
        });
      });

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
              school: sanitizeSchool(pickSchoolForProgram(p.id)),
              ayStart,
              students
            });
	          });
	        });
	      });
      let cohorts = cohortSeeds.filter(c => c.ayStart >= AY_VISIBLE_MIN && c.ayStart <= AY_VISIBLE_MAX);
      if (programAccessSet.size && !isHealthcareView){
        cohorts = cohorts.filter(c => {
          const key = `${normalizeSchool(c.school)}|${normalizeProgramLabel(c.program)}`;
          return programAccessSet.has(key);
        });
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
      cohorts = cohorts.map(c => ({ ...c, school: sanitizeSchool(c.school || pickSchoolForProgram(c.program)) }));

      // Cohort filter
      const cohortFilter = document.getElementById('cohortFilter');
      const cohortFilterWrap = cohortFilter?.closest('[data-cohort-filter]');
      const cohortFilterMenu = cohortFilterWrap?.querySelector('[data-cohort-menu]');

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
      const AUTO_COMPLETE_REQS = { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' };

      function isAutoCompleteUser(user){
        if (!requirementsStore?.isAutoApprovedStudent) return false;
        return requirementsStore.isAutoApprovedStudent({
          email: user.email,
          sid: user.sid,
          studentId: user.studentId
        });
      }

      function applyAutoApprovedStatus(user){
        if (!isAutoCompleteUser(user)) return user;
        user.reqs = { ...(user.reqs || {}), ...AUTO_COMPLETE_REQS };
        user.status = 'complete';
        if (user.reqMeta){
          user.reqMeta.expiringAt = '';
          user.reqMeta.expiringDays = null;
        }
        return user;
      }
      function normalizeProgramDisplay(label){
        const name = String(label || '').toLowerCase();
        if (name.includes('surg')) return 'Surg Tech';
        if (name.includes('rad')) return 'Radiologic Technology';
        if (name.includes('resp')) return 'Respiratory Care';
        if (name.includes('sonography') || name.includes('sono') || name.includes('dms')) return 'Diagnostic Medical Sonography';
        if (name.includes('medassistant') || name.includes('medassist')) return 'Medical Assistant';
        if (name.includes('bsn')) return 'BSN';
        if (name.includes('adn')) return 'ADN';
        return label || 'BSN';
      }

      const sharedRoster = (window.CPNW && typeof window.CPNW.getSharedRoster === 'function')
        ? window.CPNW.getSharedRoster()
        : [];
      let assignments = loadAssignments();
      const assignmentNormalizer = (window.CPNW && typeof window.CPNW.normalizeAssignments === 'function')
        ? window.CPNW.normalizeAssignments
        : null;
      if (assignmentNormalizer){
        const normalized = assignmentNormalizer(assignments, sharedRoster, { maxCurrent: 1, maxPast: 1 });
        if (normalized && Array.isArray(normalized.list)){
          assignments = normalized.list;
          if (normalized.changed) saveAssignments(assignments);
        }
      }
      sharedRoster.forEach(person => {
        const role = String(person.role || '').toLowerCase();
        if (!['student','faculty','faculty-admin'].includes(role)) return;
        const program = normalizeProgramDisplay(person.program || person.programs?.[0]);
        const school = sanitizeSchool(person.school || person.schools?.[0] || pickSchoolForProgram(program));
        const record = applyCohortOverride({
          name: person.name,
          email: person.email,
          program,
          school,
          cohort: person.cohort || '',
          role: person.role,
          studentId: person.studentId || person.profile?.studentId || '',
          sid: person.sid || person.profile?.sid || '',
          reqs: person.reqs || { cpnw: 'complete', ed: 'complete', hc: 'complete', oig: 'pass', sam: 'pass' },
          docs: person.docItems ? person.docItems.length : 0,
          docItems: person.docItems || []
        });
        record.status = computeComplianceStatus(record);
        users.push(record);
      });
      users.forEach(applyAutoApprovedStatus);

      const cohortMap = new Map();
      users.forEach(user => {
        const label = (user.cohort || '').trim();
        if (!label) return;
        const key = label.toLowerCase();
        if (cohortMap.has(key)) return;
        cohortMap.set(key, {
          cohortLabel: label,
          program: user.program,
          school: user.school
        });
      });
      cohorts = Array.from(cohortMap.values());

      if (programAccessSet.size && !isHealthcareView){
        for (let i = users.length - 1; i >= 0; i--){
          const key = `${normalizeSchool(users[i].school)}|${normalizeProgramLabel(users[i].program)}`;
          if (!programAccessSet.has(key)){
            users.splice(i, 1);
          }
        }
      }
      if (isHealthcareView){
        const { ids, sids, emails } = buildHealthcareEligibility(assignments, facilityNames);
        for (let i = users.length - 1; i >= 0; i--){
          const user = users[i];
          const role = String(user.role || '').toLowerCase();
          if (!['student','faculty','faculty-admin'].includes(role)){
            users.splice(i, 1);
            continue;
          }
          const idMatch = user.studentId && ids.has(String(user.studentId));
          const sidMatch = user.sid && sids.has(String(user.sid));
          const emailMatch = user.email && emails.has(normalizeEmail(user.email));
          if (!idMatch && !sidMatch && !emailMatch){
            users.splice(i, 1);
          }
        }
      }

      const reportSearch = document.getElementById('reportSearch');
      const locationFilter = document.getElementById('locationFilter');
      const schoolFilter = document.getElementById('schoolFilter');
      const programFilterSelect = document.getElementById('programFilter');
      const reportTableBody = document.getElementById('reportTableBody');
      const selectAllReports = document.getElementById('selectAllReports');
      const showAllBtn = document.getElementById('showAll');
      const showSelectedBtn = document.getElementById('showSelected');
      const approveSelectedBtn = document.getElementById('approveSelected');
      const exportBtn = document.getElementById('exportBtn');
      const reportPageSizeSelect = document.getElementById('reportPageSize');
      const reportPrevPage = document.getElementById('reportPrevPage');
      const reportNextPage = document.getElementById('reportNextPage');
      const reportPageInfo = document.getElementById('reportPageInfo');
      const reqModalBody = document.getElementById('reqModalBody');
      const reqModalLabel = document.getElementById('reqModalLabel');
      const reqModalSub = document.getElementById('reqModalSub');
      const rejectModalEl = document.getElementById('rejectAssignmentModal');
      const rejectModal = rejectModalEl ? new bootstrap.Modal(rejectModalEl) : null;
      const rejectReasonInput = document.getElementById('rejectReasonInput');
      const rejectReasonError = document.getElementById('rejectReasonError');
      const rejectModalSub = document.getElementById('rejectAssignmentModalSub');
      const confirmRejectAssignment = document.getElementById('confirmRejectAssignment');
      const approveWarningModalEl = document.getElementById('approveWarningModal');
      const approveWarningModal = approveWarningModalEl ? new bootstrap.Modal(approveWarningModalEl) : null;
      const approveWarningList = document.getElementById('approveWarningList');
      const approveAnywayBtn = document.getElementById('approveAnywayBtn');
      const reviewModalEl = document.getElementById('assignmentReviewModal');
      const reviewModal = reviewModalEl ? new bootstrap.Modal(reviewModalEl) : null;
      const reviewModalSub = document.getElementById('assignmentReviewSub');
      const reviewLocation = document.getElementById('assignmentReviewLocation');
      const reviewStart = document.getElementById('assignmentReviewStart');
      const reviewEnd = document.getElementById('assignmentReviewEnd');
      const reviewStatus = document.getElementById('assignmentReviewStatus');
      const reviewReason = document.getElementById('assignmentReviewReason');
      const reviewApproveBtn = document.getElementById('assignmentReviewApprove');
      const reviewRejectBtn = document.getElementById('assignmentReviewReject');
      const statusFilterButtons = document.querySelectorAll('[data-status-filter]');
      const allowedStatusFilters = new Set(['approved', 'pending', 'rejected']);
      const buildMultiSelect = (window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
        ? window.CPNW.buildCheckboxMultiSelect
        : null;
      const useSeparateFilters = isHealthcareView && schoolFilter && !!buildMultiSelect;
      const assignmentLocationMap = buildAssignmentLocationMap(assignments, facilityNames);
      const assignmentLookup = buildAssignmentLookup(assignments, facilityNames);

      if (locationFilter){
        locationFilter.innerHTML = [
          '<option value="">All locations</option>',
          ...facilityLabels.map(loc => `<option value="${loc}">${loc}</option>`)
        ].join('');
      }
      function getProgramsBySchool(){
        if (Object.keys(accessSummary.programsBySchool || {}).length){
          return accessSummary.programsBySchool;
        }
        return cohorts.reduce((acc, c) => {
          if (!c.school || !c.program) return acc;
          acc[c.school] ||= [];
          acc[c.school].push(c.program);
          return acc;
        }, {});
      }

      function handleFilterChange(){
        reportPage = 1;
        updateCohortItems();
        renderReports();
      }

      const schoolFilterWrap = schoolFilter?.closest('[data-school-filter]');
      const schoolFilterMenu = schoolFilterWrap?.querySelector('[data-school-menu]');
      const programFilterWrap = programFilterSelect?.closest('[data-program-filter]');
      const programFilterMenu = programFilterWrap?.querySelector('[data-program-menu]');
      const programFilterControl = (!useSeparateFilters && window.CPNW && typeof window.CPNW.buildProgramFilter === 'function')
        ? window.CPNW.buildProgramFilter({
          input: programFilterSelect,
          menu: programFilterMenu,
          programsBySchool: getProgramsBySchool(),
          formatProgramLabel,
          onChange: () => {
            reportPage = 1;
            updateCohortItems();
            renderReports();
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
          input: programFilterSelect,
          menu: programFilterMenu,
          items: [],
          placeholder: 'All programs',
          onChange: handleFilterChange
        })
        : null;
      const cohortFilterControl = (isHealthcareView && buildMultiSelect)
        ? buildMultiSelect({
          input: cohortFilter,
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
            normalizeSchool(sel.school) === normalizeSchool(c.school)
            && normalizeProgramLabel(sel.program) === normalizeProgramLabel(c.program)
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
          const source = users.slice();
          const schoolItems = new Map();
          source.forEach(user => {
            const label = String(user.school || '').trim();
            if (!label) return;
            const value = normalizeSchool(label);
            if (!schoolItems.has(value)) schoolItems.set(value, label);
          });
          schoolFilterControl.setItems(Array.from(schoolItems.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label })));

          const schoolSelections = new Set(schoolFilterControl.getSelection());
          const schoolFiltered = schoolSelections.size
            ? source.filter(user => schoolSelections.has(normalizeSchool(user.school)))
            : source;

          const programItems = new Map();
          schoolFiltered.forEach(user => {
            const label = String(user.program || '').trim();
            if (!label) return;
            const value = normalizeProgramLabel(label);
            if (!value) return;
            if (!programItems.has(value)) programItems.set(value, formatProgramLabel(label));
          });
          programMultiFilterControl.setItems(Array.from(programItems.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label })));

          const programSelections = new Set(programMultiFilterControl.getSelection());
          const programFiltered = programSelections.size
            ? schoolFiltered.filter(user => programSelections.has(normalizeProgramLabel(user.program)))
            : schoolFiltered;

          const cohortItems = new Map();
          cohortItems.set('__unassigned__', { value: '__unassigned__', label: 'Unassigned', group: '' });
          programFiltered.forEach(user => {
            const raw = String(user.cohort || '').trim();
            const value = raw || '__unassigned__';
            if (cohortItems.has(value)) return;
            const label = raw || 'Unassigned';
            const group = formatProgramLabel(user.program || '') || '';
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
      }

      function getUserLocations(user){
        if (!assignmentLocationMap.size) return new Set();
        const keys = [];
        if (user.studentId) keys.push(`id:${user.studentId}`);
        if (user.sid) keys.push(`sid:${user.sid}`);
        if (user.email) keys.push(`email:${normalizeEmail(user.email)}`);
        const locations = new Set();
        keys.forEach(key => {
          const set = assignmentLocationMap.get(key);
          if (!set) return;
          set.forEach(loc => locations.add(loc));
        });
        return locations;
      }

      function assignmentSortValue(assignment){
        if (assignment?.start instanceof Date && !Number.isNaN(assignment.start.getTime())){
          return assignment.start.getTime();
        }
        if (assignment?.end instanceof Date && !Number.isNaN(assignment.end.getTime())){
          return assignment.end.getTime();
        }
        return Number.MAX_SAFE_INTEGER;
      }

      function getUserAssignments(user, locationSelection = ''){
        if (!assignmentLookup.size) return [];
        const keys = [];
        if (user.studentId) keys.push(`id:${user.studentId}`);
        if (user.sid) keys.push(`sid:${user.sid}`);
        if (user.email) keys.push(`email:${normalizeEmail(user.email)}`);
        const list = [];
        const seen = new Set();
        keys.forEach(key => {
          const items = assignmentLookup.get(key) || [];
          items.forEach(item => {
            if (!item || !item.id || seen.has(item.id)) return;
            seen.add(item.id);
            list.push(item);
          });
        });
        const scoped = locationSelection
          ? list.filter(item => String(item.location || '').trim() === locationSelection)
          : list;
        return scoped.sort((a, b) => assignmentSortValue(a) - assignmentSortValue(b));
      }

      function getPrimaryAssignment(user, locationSelection = ''){
        const list = getUserAssignments(user, locationSelection);
        return list.length ? list[0] : null;
      }

      updateCohortItems();
      let reportPage = 1;
      let reportPageSize = Number(reportPageSizeSelect?.value || 10);
      const selectedIds = new Set();
      let showOnlySelected = false;
      let currentStatusFilter = '';
      let pendingRejectId = '';
      let pendingReviewId = '';
      let pendingApproveIds = [];

      function findAssignmentById(id){
        return assignments.find(item => String(item.id || '') === String(id || '')) || null;
      }

      function findPersonForAssignment(assignment){
        if (!assignment) return null;
        return users.find(u => String(u.studentId || '') === String(assignment.studentId || '')
          || String(u.sid || '') === String(assignment.studentSid || '')
          || normalizeEmail(u.email) === normalizeEmail(assignment.studentEmail));
      }

      function approveAssignment(assignment){
        if (!assignment) return;
        assignment.status = 'approved';
        assignment.rejectionReason = '';
        assignment.rejectionAt = '';
        saveAssignments(assignments);
        renderReports();
      }

      function rejectAssignment(assignment, reason){
        if (!assignment) return;
        assignment.status = 'rejected';
        assignment.rejectionReason = reason;
        assignment.rejectionAt = new Date().toISOString();
        saveAssignments(assignments);
        renderReports();
      }

      function requirementStatus(person, name, category, isElearning){
        if (!requirementsStore || !person) return '';
        return requirementsStore.getStatus(
          { sid: person.sid || '', email: person.email || '' },
          name,
          { category, isElearning }
        );
      }

      function isApprovedStatus(status, isElearning){
        const norm = String(status || '').toLowerCase();
        if (isElearning) return norm === 'approved';
        return APPROVED_STATUSES.has(norm);
      }

      function listMissingRequirements(person){
        if (!person) return [];
        const missing = [];
        CPNW_ELEARNING.forEach(name => {
          const status = requirementStatus(person, name, 'CPNW Clinical Passport', true);
          if (!isApprovedStatus(status, true)){
            missing.push({ name, status: status || 'Not Submitted' });
          }
        });
        CPNW_REQUIREMENTS.forEach(name => {
          const status = requirementStatus(person, name, 'CPNW Clinical Passport', false);
          if (!isApprovedStatus(status, false)){
            missing.push({ name, status: status || 'Not Submitted' });
          }
        });
        HEALTHCARE_REQUIREMENTS.forEach(name => {
          const status = requirementStatus(person, name, 'Healthcare', false);
          if (!isApprovedStatus(status, false)){
            missing.push({ name, status: status || 'Not Submitted' });
          }
        });
        return missing;
      }

      function renderApprovalWarnings(warnings){
        if (!approveWarningList) return;
        if (!warnings.length){
          approveWarningList.innerHTML = '<li class="list-group-item text-body-secondary small">All selected assignments are ready to approve.</li>';
          return;
        }
        approveWarningList.innerHTML = warnings.map(item => {
          const missingList = item.missing
            .map(req => `${req.name} (${req.status})`)
            .join(', ');
          const link = item.sid
            ? `<a class="btn btn-outline-secondary btn-sm btn-cpnw" href="review-healthcare.html?sid=${encodeURIComponent(item.sid)}" target="_blank" rel="noopener">View requirements</a>`
            : '';
          return `
            <li class="list-group-item">
              <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div class="fw-semibold">${item.name}</div>
                  <div class="small text-body-secondary">${missingList || 'Missing requirements'}</div>
                </div>
                ${link}
              </div>
            </li>
          `;
        }).join('');
      }

      function collectApprovalWarnings(ids){
        const warnings = [];
        const locationSelection = isHealthcareView ? String(locationFilter?.value || '').trim() : '';
        ids.forEach(email => {
          const person = users.find(u => u.email === email);
          if (!person) return;
          const assignment = getPrimaryAssignment(person, locationSelection);
          if (!assignment) return;
          const missing = listMissingRequirements(person);
          if (missing.length){
            warnings.push({ email, name: person.name, sid: person.sid || '', missing });
          }
        });
        return warnings;
      }

      function applyApproval(ids){
        if (!ids.length) return 0;
        let updatedCount = 0;
        const locationSelection = isHealthcareView ? String(locationFilter?.value || '').trim() : '';
        ids.forEach(email => {
          const user = users.find(u => u.email === email);
          if (!user) return;
          const assignment = getPrimaryAssignment(user, locationSelection);
          if (!assignment) return;
          assignment.status = 'approved';
          assignment.rejectionReason = '';
          assignment.rejectionAt = '';
          updatedCount += 1;
        });
        if (updatedCount) saveAssignments(assignments);
        return updatedCount;
      }

      function handleApprove(ids){
        const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
        if (!uniqueIds.length){
          alert('Select at least one assignment to approve.');
          return;
        }
        const warnings = collectApprovalWarnings(uniqueIds);
        if (warnings.length){
          pendingApproveIds = uniqueIds;
          renderApprovalWarnings(warnings);
          approveWarningModal?.show();
          return;
        }
        const approvedCount = applyApproval(uniqueIds);
        if (!approvedCount){
          alert('No assignments are available to approve for the selected users.');
          return;
        }
        alert(`Successfully approved ${approvedCount} assignment${approvedCount === 1 ? '' : 's'}.`);
        renderReports();
      }

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

      function assignmentStatusBadge(val){
        const normalized = String(val || '').toLowerCase();
        if (!normalized) return '<span class="text-body-secondary">—</span>';
        if (normalized === 'approved') return '<span class="badge text-bg-success">Approved</span>';
        if (normalized === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
        return '<span class="badge text-bg-secondary">Pending</span>';
      }

      function assignmentStatusKey(status){
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'approved') return 'approved';
        if (normalized === 'rejected') return 'rejected';
        return 'pending';
      }

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
      const HEALTHCARE_REQUIREMENTS = Array.from({ length: 6 }, (_, idx) => `Healthcare Req ${idx + 1}`);
      const reqLabels = { cpnw:'CPNW', ed:'Education', hc:'Healthcare' };
      const APPROVED_STATUSES = new Set(['approved','conditionally approved']);
      const EXPIRING_STATUSES = new Set(['expired','expiring','expiring soon']);
      const STATUS_BADGE_MAP = {
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

      function getRequirementNames(type){
        if (type === 'cpnw') return [...CPNW_ELEARNING, ...CPNW_REQUIREMENTS];
        if (type === 'ed') return Array.from({ length: 4 }, (_, i) => `Education Req ${i + 1}`);
        if (type === 'hc') return [...HEALTHCARE_REQUIREMENTS];
        return [];
      }

      function buildFallbackReqList(type, overallStatus){
        const names = getRequirementNames(type);
        const normalized = String(overallStatus || '').toLowerCase();
        return names.map((name, idx) => {
          let status = 'Approved';
          if (normalized === 'expiring'){
            status = (idx % 5 === 0) ? 'Expiring Soon' : 'Approved';
          }else if (normalized && normalized !== 'complete'){
            status = (idx % 4 === 0) ? 'Not Submitted' : 'Approved';
          }
          return { name, status };
        });
      }

      function getRequirementList(type, user){
        const names = getRequirementNames(type);
        if (!names.length || !user) return [];
        if (!requirementsStore) return buildFallbackReqList(type, user.reqs?.[type]);
        return names.map((name, idx) => {
          const isCPNW = type === 'cpnw';
          const isElearning = isCPNW && idx < CPNW_ELEARNING.length;
          const category = isCPNW ? 'CPNW Clinical Passport' : (type === 'hc' ? 'Healthcare' : 'Education');
          const status = requirementsStore.getStatus({
            sid: user.sid,
            email: user.email,
            studentId: user.studentId
          }, name, { category, isElearning });
          return { name, status };
        });
      }

      function summarizeRequirementList(list){
        let hasExpiring = false;
        let hasIncomplete = false;
        list.forEach(item => {
          const statusKey = String(item?.status || '').toLowerCase();
          if (!statusKey){
            hasIncomplete = true;
            return;
          }
          if (EXPIRING_STATUSES.has(statusKey)){
            hasExpiring = true;
            return;
          }
          if (!APPROVED_STATUSES.has(statusKey)){
            hasIncomplete = true;
          }
        });
        if (hasExpiring) return 'expiring';
        if (hasIncomplete) return 'incomplete';
        return 'complete';
      }

      function requirementStatusBadge(status){
        const label = status ? String(status) : 'Not Submitted';
        const cls = STATUS_BADGE_MAP[label] || 'text-bg-secondary';
        return `<span class="badge ${cls}">${label}</span>`;
      }

      function renderReports(){
        const q = (reportSearch?.value || '').toLowerCase();
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
          ...cohorts.map(c => c.cohortLabel),
          ...users.map(u => u.cohort).filter(Boolean),
          '__unassigned__'
        ]);
        const cohortSelections = cohortFilterControl
          ? cohortFilterControl.getSelection().filter(val => validCohorts.has(val))
          : (cohortFilter && validCohorts.has(cohortFilter.value) && cohortFilter.value ? [cohortFilter.value] : []);
        const cohortSet = new Set(cohortSelections);
        const hasCohortSelections = cohortSet.size > 0;
        const locationSelection = isHealthcareView ? String(locationFilter?.value || '').trim() : '';
        const assignmentByUser = new Map();
	        const filtered = users.filter(u=>{
          if (useSeparateFilters){
            if (hasSchoolSelections && !schoolSet.has(normalizeSchool(u.school))) return false;
            if (hasProgramSelections && !programSet.has(normalizeProgramLabel(u.program))) return false;
          }else if (hasProgramSelections){
            const matchesProgram = programSelections.some(sel =>
              normalizeSchool(sel.school) === normalizeSchool(u.school)
              && normalizeProgramLabel(sel.program) === normalizeProgramLabel(u.program)
            );
            if (!matchesProgram) return false;
          }
          if (hasCohortSelections){
            const cohortLabel = (u.cohort || '').trim();
            const wantsUnassigned = cohortSet.has('__unassigned__');
            if (!cohortLabel){
              if (!wantsUnassigned) return false;
            }else if (!cohortSet.has(cohortLabel)){
              return false;
            }
          }
          if (locationSelection){
            const locations = getUserLocations(u);
            if (locations.size && !locations.has(locationSelection)) return false;
            if (!locations.size) return false;
          }
          if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
          const assignment = getPrimaryAssignment(u, locationSelection);
          if (locationSelection && !assignment) return false;
          if (currentStatusFilter){
            if (!assignment) return false;
            if (assignmentStatusKey(assignment.status) !== currentStatusFilter) return false;
          }
          if (showOnlySelected && !selectedIds.has(u.email)) return false;
          assignmentByUser.set(u.email, assignment);
          return true;
        });
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / reportPageSize));
        if (reportPage > totalPages) reportPage = totalPages;
        const start = (reportPage - 1) * reportPageSize;
        const end = Math.min(start + reportPageSize, total);
        const pageItems = filtered.slice(start, end);

	        reportTableBody.innerHTML = '';
        if (!pageItems.length){
          const tr = document.createElement('tr');
          tr.innerHTML = '<td colspan="12" class="text-body-secondary small">No reports match your filters.</td>';
          reportTableBody.appendChild(tr);
        }else{
	        pageItems.forEach(u=>{
            const assignment = assignmentByUser.get(u.email) || getPrimaryAssignment(u, locationSelection);
            const assignmentStatus = assignment?.status ? String(assignment.status).toLowerCase() : '';
            const reviewDisabled = assignment ? '' : 'disabled';
            const reqSummary = {
              cpnw: summarizeRequirementList(getRequirementList('cpnw', u)),
              ed: summarizeRequirementList(getRequirementList('ed', u)),
              hc: summarizeRequirementList(getRequirementList('hc', u))
            };

	          const tr = document.createElement('tr');
	          tr.innerHTML = `
	            <td><input type="checkbox" class="form-check-input report-row" data-id="${u.email}" ${selectedIds.has(u.email) ? 'checked' : ''}></td>
	            <td class="fw-semibold" title="${u.cohort ? u.cohort : 'No Cohort Assigned'}">${u.name}</td>
	            <td>${u.school || '—'}</td>
	            <td class="cpnw-cell-tight">${u.program}</td>
	            <td><button class="btn btn-outline-secondary btn-sm" data-docs="${u.name}">Open</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="cpnw" data-user="${u.email}">${statusBadge(reqSummary.cpnw)}</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="ed" data-user="${u.email}">${statusBadge(reqSummary.ed)}</button></td>
	            <td><button class="btn btn-link p-0 text-decoration-none req-cell" data-req-type="hc" data-user="${u.email}">${statusBadge(reqSummary.hc)}</button></td>
	            <td>${statusBadge(u.reqs?.oig)}</td>
	            <td>${statusBadge(u.reqs?.sam)}</td>
	            <td class="text-center">${assignmentStatusBadge(assignmentStatus)}</td>
	            <td class="text-center">
                <button class="btn btn-outline-secondary btn-sm" type="button" data-review-assignment="${assignment ? assignment.id : ''}" ${reviewDisabled}>
                  Review
                </button>
              </td>
	          `;
	          reportTableBody.appendChild(tr);
	        });
        }

        if (reportPageInfo){
          reportPageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (reportPrevPage && reportNextPage){
          reportPrevPage.disabled = reportPage <= 1;
          reportNextPage.disabled = end >= total;
        }
      }

      [reportSearch, cohortFilter, locationFilter].forEach(el=>{
        if (!el) return;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', ()=>{
          reportPage = 1;
          renderReports();
        });
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

        const reviewBtn = e.target.closest('[data-review-assignment]');
        if (reviewBtn){
          const assignmentId = reviewBtn.dataset.reviewAssignment;
          const assignment = findAssignmentById(assignmentId);
          if (!assignment) return;
          pendingReviewId = assignmentId;
          const person = users.find(u => String(u.studentId || '') === String(assignment.studentId || '')
            || String(u.sid || '') === String(assignment.studentSid || '')
            || normalizeEmail(u.email) === normalizeEmail(assignment.studentEmail));
          if (reviewModalSub){
            reviewModalSub.textContent = person ? `${person.name} • ${person.program || ''}` : 'Assignment details';
          }
          if (reviewLocation) reviewLocation.textContent = assignment.location || '—';
          if (reviewStart) reviewStart.textContent = formatShortDate(assignment.start);
          if (reviewEnd) reviewEnd.textContent = formatShortDate(assignment.end);
          if (reviewStatus) reviewStatus.innerHTML = assignmentStatusBadge(assignment.status);
          if (reviewReason){
            reviewReason.textContent = assignment.rejectionReason ? assignment.rejectionReason : '—';
          }
          reviewModal?.show();
        }

        const reqBtn = e.target.closest('.req-cell');
        if (reqBtn){
          const type = reqBtn.dataset.reqType;
          const userId = reqBtn.dataset.user;
          const person = users.find(u=>u.email === userId);
          if (person){
            const list = getRequirementList(type, person);
            reqModalLabel.textContent = `${reqLabels[type] || type.toUpperCase()} requirements`;
            reqModalSub.textContent = person.name;
            reqModalBody.innerHTML = list.map(item=>`
              <tr>
                <td>${item.name}</td>
                <td>${requirementStatusBadge(item.status)}</td>
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

      reviewApproveBtn?.addEventListener('click', () => {
        const assignment = findAssignmentById(pendingReviewId);
        if (!assignment) return;
        const person = findPersonForAssignment(assignment);
        if (person?.email){
          reviewModal?.hide();
          pendingReviewId = '';
          handleApprove([person.email]);
          return;
        }
        approveAssignment(assignment);
        pendingReviewId = '';
        reviewModal?.hide();
      });

      reviewRejectBtn?.addEventListener('click', () => {
        const assignment = findAssignmentById(pendingReviewId);
        if (!assignment) return;
        pendingRejectId = assignment.id;
        if (rejectModalSub){
          const person = findPersonForAssignment(assignment);
          const label = person ? `${person.name} • ${assignment.location || 'Assignment'}` : 'Let the student know what needs attention.';
          rejectModalSub.textContent = label;
        }
        if (rejectReasonInput) rejectReasonInput.value = assignment.rejectionReason || '';
        if (rejectReasonError){
          rejectReasonError.classList.add('d-none');
          rejectReasonError.textContent = '';
        }
        reviewModal?.hide();
        rejectModal?.show();
      });

      reviewModalEl?.addEventListener('hidden.bs.modal', () => {
        pendingReviewId = '';
        if (reviewModalSub) reviewModalSub.textContent = '';
        if (reviewLocation) reviewLocation.textContent = '—';
        if (reviewStart) reviewStart.textContent = '—';
        if (reviewEnd) reviewEnd.textContent = '—';
        if (reviewStatus) reviewStatus.textContent = '—';
        if (reviewReason) reviewReason.textContent = '—';
      });

      confirmRejectAssignment?.addEventListener('click', () => {
        const assignment = findAssignmentById(pendingRejectId);
        if (!assignment) return;
        const reason = String(rejectReasonInput?.value || '').trim();
        if (!reason){
          if (rejectReasonError){
            rejectReasonError.textContent = 'Please provide a reason for the rejection.';
            rejectReasonError.classList.remove('d-none');
          }
          return;
        }
        rejectAssignment(assignment, reason);
        pendingRejectId = '';
        rejectModal?.hide();
      });

      rejectModalEl?.addEventListener('hidden.bs.modal', () => {
        if (rejectReasonInput) rejectReasonInput.value = '';
        if (rejectReasonError){
          rejectReasonError.classList.add('d-none');
          rejectReasonError.textContent = '';
        }
        if (rejectModalSub){
          rejectModalSub.textContent = 'Let the student know what needs attention.';
        }
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

      function updateSelectionButtons(){
        if (showAllBtn){
          showAllBtn.classList.toggle('btn-cpnw', !showOnlySelected);
          showAllBtn.classList.toggle('btn-cpnw-primary', !showOnlySelected);
          showAllBtn.classList.toggle('btn-outline-secondary', showOnlySelected);
        }
        if (showSelectedBtn){
          showSelectedBtn.classList.toggle('btn-cpnw', showOnlySelected);
          showSelectedBtn.classList.toggle('btn-cpnw-primary', showOnlySelected);
          showSelectedBtn.classList.toggle('btn-outline-secondary', !showOnlySelected);
        }
      }

      showAllBtn?.addEventListener('click', () => {
        showOnlySelected = false;
        updateSelectionButtons();
        renderReports();
      });

      showSelectedBtn?.addEventListener('click', () => {
        showOnlySelected = true;
        updateSelectionButtons();
        renderReports();
      });

      function applyStatusFilter(next){
        currentStatusFilter = String(next || '');
        statusFilterButtons.forEach(btn => {
          const active = String(btn.dataset.statusFilter || '') === currentStatusFilter;
          btn.classList.toggle('btn-cpnw', active);
          btn.classList.toggle('btn-cpnw-primary', active);
          btn.classList.toggle('btn-outline-secondary', !active);
        });
        reportPage = 1;
        renderReports();
      }

      statusFilterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          applyStatusFilter(btn.dataset.statusFilter || '');
        });
      });

      if (isHealthcareView){
        const statusParam = new URLSearchParams(window.location.search).get('status');
        const normalizedStatus = String(statusParam || '').toLowerCase();
        if (allowedStatusFilters.has(normalizedStatus)){
          applyStatusFilter(normalizedStatus);
        }
      }

      approveSelectedBtn?.addEventListener('click', () => {
        handleApprove(Array.from(selectedIds));
      });

      approveAnywayBtn?.addEventListener('click', () => {
        if (!pendingApproveIds.length){
          approveWarningModal?.hide();
          return;
        }
        if (!applyApproval(pendingApproveIds)){
          alert('No assignments are available to approve for the selected users.');
        }
        pendingApproveIds = [];
        approveWarningModal?.hide();
        renderReports();
      });

      exportBtn?.addEventListener('click', () => {
        alert(`Exporting ${selectedIds.size} selected records (demo).`);
      });

      updateSelectionButtons();
      if (!currentStatusFilter){
        applyStatusFilter('');
      }
      renderReports();
    })();
  
