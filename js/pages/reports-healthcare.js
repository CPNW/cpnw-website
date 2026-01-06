
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

      function loadAssignments(){
        try{
          const raw = localStorage.getItem(ASSIGNMENTS_KEY);
          if (!raw) return [];
          return hydrateAssignments(JSON.parse(raw));
        }catch{
          return [];
        }
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

      function buildHealthcareEligibility(){
        const assignments = loadAssignments();
        const facilityNames = getHealthcareFacilityNames();
        const ids = new Set();
        const sids = new Set();
        assignments.forEach(assignment => {
          if (!assignmentMatchesFacility(assignment, facilityNames)) return;
          if (!assignmentWithinWindow(assignment)) return;
          if (assignment.studentId) ids.add(String(assignment.studentId));
          if (assignment.studentSid) sids.add(String(assignment.studentSid));
        });
        return { ids, sids };
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
        const { ids, sids } = buildHealthcareEligibility();
        for (let i = users.length - 1; i >= 0; i--){
          const user = users[i];
          const role = String(user.role || '').toLowerCase();
          if (!['student','faculty','faculty-admin'].includes(role)){
            users.splice(i, 1);
            continue;
          }
          const idMatch = user.studentId && ids.has(String(user.studentId));
          const sidMatch = user.sid && sids.has(String(user.sid));
          if (!idMatch && !sidMatch){
            users.splice(i, 1);
          }
        }
      }

      const statusButtons = document.querySelectorAll('[data-status]');
      const reportSearch = document.getElementById('reportSearch');
      const locationFilter = document.getElementById('locationFilter');
      const schoolFilter = document.getElementById('schoolFilter');
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
      const buildMultiSelect = (window.CPNW && typeof window.CPNW.buildCheckboxMultiSelect === 'function')
        ? window.CPNW.buildCheckboxMultiSelect
        : null;
      const useSeparateFilters = isHealthcareView && schoolFilter && !!buildMultiSelect;
      const assignmentLocationMap = buildAssignmentLocationMap(loadAssignments(), facilityNames);

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

      updateCohortItems();
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
	        const filtered = users.filter(u=>{
	          if (currentStatus !== 'all' && u.status !== currentStatus) return false;
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
  
