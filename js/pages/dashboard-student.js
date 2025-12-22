
    (function(){
      const EXPIRY_WINDOW_DAYS = 30;
      const TODAY = new Date();
      const startOfToday = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
      const addDays = (d) => {
        const x = new Date(startOfToday);
        x.setDate(x.getDate() + d);
        return x;
      };

      const currentUser = (window.CPNW && typeof window.CPNW.getCurrentUser === 'function')
        ? window.CPNW.getCurrentUser()
        : null;
      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];
      const demoPerson = currentUser
        ? demoPeople.find(p => p.email.toLowerCase() === currentUser.email.toLowerCase())
        : null;
      const STUDENT_DATA_KEY = currentUser?.email
        ? `cpnw-student-data-${currentUser.email.toLowerCase()}`
        : 'cpnw-student-data-v1';

      const nameTarget = document.querySelector('[data-current-user-name]');
      if (nameTarget && currentUser?.name){
        nameTarget.textContent = currentUser.name;
      }
      const roleLabel = document.querySelector('[data-dashboard-role-label]');
      if (roleLabel && currentUser?.role === 'faculty'){
        roleLabel.textContent = 'Faculty';
      }

      const reqTypePool = ['Immunization', 'Forms', 'Certs', 'Insurance', 'Licenses', 'Site Orientation'];
      const ELEARNING_MODULES = [
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

      function programKeyFromName(name){
        const n = String(name || '').toLowerCase();
        if (n.includes('bsn')) return 'bsn';
        if (n.includes('adn')) return 'adn';
        if (n.includes('surg')) return 'surg';
        if (n.includes('rad')) return 'rad';
        return '';
      }

      const programName = currentUser?.programs?.[0] || currentUser?.profile?.program || '';
      const programKey = programKeyFromName(programName);
      const programPackages = {
        bsn: { background: 'CPNW: Independent Background Check', watch: 'CPNW: Independent WATCH' },
        adn: { background: 'CPNW: Checkr Background Check', watch: 'CPNW: CPNW WATCH' },
        surg: { background: 'CPNW: Checkr Background Check', watch: 'CPNW: Independent WATCH' },
        rad: { background: 'CPNW: Independent Background Check', watch: 'CPNW: CPNW WATCH' }
      };

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
        programPackages[programKey]?.background || 'CPNW: Independent Background Check',
        programPackages[programKey]?.watch || 'CPNW: Independent WATCH'
      ];
      const cpnwNonELearningCount = CPNW_REQUIREMENTS.length;
      const edCount = 6;
      const hcCount = 7;

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

      function loadStudentData(){
        const raw = loadJSON(STUDENT_DATA_KEY, null);
        // Back-compat: previous versions stored a flat map of submissions.
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)){
          return { submissions: {}, elearning: {} };
        }
        const submissions = raw.submissions && typeof raw.submissions === 'object' && !Array.isArray(raw.submissions) ? raw.submissions : {};
        const elearning = raw.elearning && typeof raw.elearning === 'object' && !Array.isArray(raw.elearning) ? raw.elearning : {};
        return { submissions, elearning };
      }

      function saveStudentData(next){
        saveJSON(STUDENT_DATA_KEY, next);
      }

      function fmtDate(d){
        if (!(d instanceof Date)) return '';
        return d.toLocaleDateString(undefined, { month:'short', day:'2-digit', year:'numeric' });
      }

      function statusBadge(status){
        const norm = String(status || '').toLowerCase();
        if (norm === 'complete') return '<span class="badge text-bg-success">Approved</span>';
        if (norm === 'approved') return '<span class="badge text-bg-success">Approved</span>';
        if (norm === 'submitted') return '<span class="badge text-bg-info">Submitted</span>';
        if (norm === 'expiring') return '<span class="badge text-bg-warning text-dark">Expiring</span>';
        if (norm === 'expiring soon') return '<span class="badge text-bg-warning text-dark">Expiring soon</span>';
        if (norm === 'expired') return '<span class="badge text-bg-danger">Expired</span>';
        if (norm === 'not submitted') return '<span class="badge text-bg-secondary">Not submitted</span>';
        return '<span class="badge text-bg-secondary">Incomplete</span>';
      }

      function normalizeDay(d){
        if (!(d instanceof Date)) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }

      function computeExpiryStatus(expiration){
        const expDay = normalizeDay(expiration);
        if (!expDay) return { status:'', days:null };
        const diffDays = Math.round((expDay.getTime() - startOfToday.getTime()) / 86400000);
        if (diffDays < 0) return { status:'expired', days:diffDays };
        if (diffDays <= EXPIRY_WINDOW_DAYS) return { status:'expiring', days:diffDays };
        return { status:'', days:diffDays };
      }

      function overallStatusFor(group){
        if (!demoPerson || !demoPerson.reqs) return '';
        return String(demoPerson.reqs[group] || '').toLowerCase();
      }

      function statusForGroup(group, index, baseStatus, expiresOverrideDays){
        const overall = overallStatusFor(group);
        if (overall === 'complete') return { status: 'complete', expiration: null };
        if (overall === 'expiring'){
          return { status: index === 0 ? 'expiring' : 'complete', expiration: addDays(expiresOverrideDays || 12) };
        }
        if (overall === 'incomplete'){
          return { status: index % 3 === 0 ? 'incomplete' : 'complete', expiration: null };
        }
        return { status: baseStatus, expiration: null };
      }

      function buildRequirements(){
        const list = [];
        // eLearning (10)
        for (let i = 1; i <= ELEARNING_MODULES.length; i++){
          const moduleId = `elearn_${i}`;
          const moduleName = ELEARNING_MODULES[i - 1];
          const history = studentData.elearning?.[moduleId] || {};
          const attempts = Array.isArray(history.attempts) ? history.attempts : [];
          const passedAt = history.passedAt ? new Date(history.passedAt) : null;
          const rawExpiresAt = history.expiresAt ? new Date(history.expiresAt) : null;
          const derivedExpiresAt = passedAt instanceof Date && !Number.isNaN(passedAt.getTime())
            ? new Date(new Date(passedAt).setFullYear(passedAt.getFullYear() + 1))
            : null;
          const expiresAt = rawExpiresAt instanceof Date && !Number.isNaN(rawExpiresAt.getTime())
            ? rawExpiresAt
            : derivedExpiresAt;
          const expiry = computeExpiryStatus(expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null);
          const status = passedAt
            ? (expiry.status === 'expired' ? 'expired' : (expiry.status === 'expiring' ? 'expiring soon' : 'approved'))
            : 'not submitted';

          const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;
          const lastScore = lastAttempt && Number.isFinite(Number(lastAttempt.score)) ? Number(lastAttempt.score) : null;
          const bestScore = attempts.reduce((acc, a) => {
            const s = Number(a?.score);
            return Number.isFinite(s) ? Math.max(acc, s) : acc;
          }, -1);
          const bestScoreVal = bestScore >= 0 ? bestScore : null;
          const lastAttemptedOn = lastAttempt?.at ? new Date(lastAttempt.at) : null;

          list.push({
            id: moduleId,
            group: 'elearning',
            label: moduleName,
            type: 'eLearning',
            frequency: 'Annual',
            status,
            attempts,
            lastScore,
            bestScore: bestScoreVal,
            attemptedOn: lastAttemptedOn instanceof Date && !Number.isNaN(lastAttemptedOn.getTime()) ? lastAttemptedOn : null,
            completedOn: passedAt instanceof Date && !Number.isNaN(passedAt.getTime()) ? passedAt : null,
            expiration: expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
            due: addDays(7 + i),
            instructionsHTML: `<p>Complete ${moduleName} and pass the knowledge check.</p><ul><li>Passing score is <strong>80+</strong>.</li><li>You can retake the module as many times as needed.</li><li>Modules expire <strong>1 year</strong> after successful completion.</li></ul><p>If you have issues launching the module, contact support.</p>`
          });
        }
        // CPNW non-eLearning (10)
        for (let i = 1; i <= cpnwNonELearningCount; i++){
          const expiration = (i % 5 === 0) ? addDays(-10) : (i % 4 === 0) ? addDays(12) : null;
          const expiry = computeExpiryStatus(expiration);
          const override = statusForGroup('cpnw', i - 1, expiry.status || ((i % 3) ? 'complete' : 'incomplete'), 14);
          const label = CPNW_REQUIREMENTS[i - 1] || `CPNW Requirement ${i}`;
          const isTdap = String(label || '').toLowerCase().includes('tetanus') && String(label || '').toLowerCase().includes('pertussis');
          const isCriminalDisclosure = String(label || '').toLowerCase().includes('criminal history disclosure');
          if (isCriminalDisclosure && override.status === 'complete') override.status = 'approved';
          const tdapInstructions = [
            '<p class="fw-semibold mb-1">Instructions</p>',
            '<p class="mb-2">CPNW Tetanus, Diphtheria, Pertussis (Tdap)</p>',
            '<p>You must provide proof of receiving the Tdap vaccine (Tetanus, Diphtheria, Pertussis). After your initial Tdap dose, a Td or Tdap booster is required every 10 years to remain compliant.</p>',
            '<p class="fw-semibold mb-1">Vaccination Documentation:</p>',
            '<ul>',
            '<li>At least one documented dose of Tdap</li>',
            '<li>And, if applicable, a Td or Tdap booster if more than 10 years have passed since the initial Tdap dose</li>',
            '</ul>'
          ].join('');
          const disclosureInstructions = [
            '<p class="fw-semibold mb-1">Instructions</p>',
            '<p class="mb-2">CPNW: Criminal History Disclosure Form</p>',
            '<p>A newly completed Criminal History Disclosure form is required each year a student is in program.</p>',
            '<p>Utilize the provided document link, complete the form, and upload document to meet this requirement.</p>'
          ].join('');
          list.push({
            id: `cpnw_${i}`,
            group: 'cpnw',
            label,
            type: isCriminalDisclosure ? 'Forms' : reqTypePool[i % reqTypePool.length],
            frequency: 'Annual',
            status: override.status,
            expiration: override.status === 'expiring' ? override.expiration : (override.status === 'incomplete' ? null : expiration),
            due: addDays(14 + i),
            instructionsHTML: isTdap
              ? tdapInstructions
              : (isCriminalDisclosure ? disclosureInstructions : `<p>Upload the required documentation for ${label}.</p>`)
          });
        }
        // Education (6)
        for (let i = 1; i <= edCount; i++){
          const expiration = (i % 6 === 0) ? addDays(9) : null;
          const expiry = computeExpiryStatus(expiration);
          const override = statusForGroup('ed', i - 1, expiry.status || ((i <= 4) ? 'complete' : 'incomplete'), 10);
          list.push({
            id: `ed_${i}`,
            group: 'ed',
            label: `Education Requirement ${i}`,
            type: reqTypePool[(i + 2) % reqTypePool.length],
            frequency: 'Annual',
            status: override.status,
            expiration: override.status === 'expiring' ? override.expiration : (override.status === 'incomplete' ? null : expiration),
            due: addDays(10 + i),
            instructionsHTML: `<p>Complete Education Requirement ${i} for your program.</p>`
          });
        }
        // Healthcare (7)
        for (let i = 1; i <= hcCount; i++){
          const expiration = (i % 7 === 0) ? addDays(-3) : (i % 4 === 0) ? addDays(22) : null;
          const expiry = computeExpiryStatus(expiration);
          const override = statusForGroup('hc', i - 1, expiry.status || ((i <= 5) ? 'complete' : 'incomplete'), 22);
          list.push({
            id: `hc_${i}`,
            group: 'hc',
            label: `Healthcare Requirement ${i}`,
            type: reqTypePool[(i + 3) % reqTypePool.length],
            frequency: 'Annual',
            status: override.status,
            expiration: override.status === 'expiring' ? override.expiration : (override.status === 'incomplete' ? null : expiration),
            due: addDays(9 + i),
            instructionsHTML: `<p>Upload documentation and complete steps for Healthcare Requirement ${i}.</p>`
          });
        }
        return list;
      }

      // Seed demo history once, if empty, to show a realistic mix.
      let studentData = loadStudentData();
      if (!Object.keys(studentData.elearning || {}).length && !Object.keys(studentData.submissions || {}).length){
        const now = new Date();
        const daysAgo = (d) => {
          const x = new Date(now);
          x.setDate(x.getDate() - d);
          return x.toISOString();
        };
        const expiresInDays = (d) => {
          const x = new Date(now);
          x.setDate(x.getDate() + d);
          return x.toISOString();
        };

        studentData = {
          submissions: {
            cpnw_1: {
              submittedAt: daysAgo(18),
              notes: 'Uploaded updated immunization record.',
              files: ['varicella-record.pdf'],
              submission: { mode: 'completed', completedDate: daysAgo(20).slice(0, 10) }
            },
            cpnw_2: {
              submittedAt: daysAgo(9),
              notes: '',
              files: ['influenza-shot-card.jpg'],
              submission: { mode: 'completed', completedDate: daysAgo(12).slice(0, 10) }
            },
            cpnw_4: {
              submittedAt: daysAgo(3),
              notes: 'Disclosure form attached.',
              files: ['criminal-history-disclosure.pdf'],
              submission: {
                mode: 'criminal_disclosure',
                disclosureDates: [daysAgo(3).slice(0, 10)]
              }
            },
            ed_1: {
              submittedAt: daysAgo(14),
              notes: 'Submitted signed acknowledgment.',
              files: ['education-requirement-1.pdf'],
              submission: { mode: 'completed', completedDate: daysAgo(15).slice(0, 10) }
            },
            hc_1: {
              submittedAt: daysAgo(6),
              notes: '',
              files: ['healthcare-clearance.pdf'],
              submission: { mode: 'completed', completedDate: daysAgo(7).slice(0, 10) }
            }
          },
          elearning: {
            // Passed modules (valid)
            elearn_1: { attempts:[{ at: daysAgo(110), score: 92 }], passedAt: daysAgo(110), expiresAt: expiresInDays(255) },
            elearn_2: { attempts:[{ at: daysAgo(102), score: 85 }], passedAt: daysAgo(102), expiresAt: expiresInDays(263) },
            elearn_3: { attempts:[{ at: daysAgo(98), score: 88 }], passedAt: daysAgo(98), expiresAt: expiresInDays(267) },
            elearn_4: { attempts:[{ at: daysAgo(90), score: 81 }], passedAt: daysAgo(90), expiresAt: expiresInDays(275) },
            elearn_5: { attempts:[{ at: daysAgo(75), score: 97 }], passedAt: daysAgo(75), expiresAt: expiresInDays(290) },
            elearn_6: { attempts:[{ at: daysAgo(61), score: 84 }], passedAt: daysAgo(61), expiresAt: expiresInDays(304) },
            // Expired module (passed >1y ago)
            elearn_7: { attempts:[{ at: daysAgo(410), score: 86 }], passedAt: daysAgo(410), expiresAt: daysAgo(45) },
            // Attempted but not passed yet
            elearn_8: { attempts:[{ at: daysAgo(8), score: 74 }, { at: daysAgo(2), score: 78 }] }
          }
        };
        saveStudentData(studentData);
      }

      function rebuildRequirements(){
        // Non-eLearning student submissions (files/notes) count as Submitted.
        const submissions = studentData.submissions || {};
        return buildRequirements().map(r => {
          if (r.group === 'elearning') return r;
          const sub = submissions[r.id];
          if (!sub || typeof sub !== 'object') return r;
          if (r.group === 'cpnw' && /criminal history disclosure/i.test(r.label || '')){
            const dates = Array.isArray(sub.submission?.disclosureDates)
              ? sub.submission.disclosureDates.map(d => new Date(d)).filter(d => !Number.isNaN(d.getTime()))
              : [];
            if (dates.length){
              const latest = dates.reduce((max, d) => d > max ? d : max, dates[0]);
              const exp = new Date(latest);
              exp.setFullYear(exp.getFullYear() + 1);
              return { ...r, status: 'approved', expiration: exp };
            }
          }
          return { ...r, status: 'submitted' };
        });
      }

      let requirements = rebuildRequirements();

      function computeProgress(group){
        const list = requirements.filter(r => r.group === group);
        const total = list.length;
        const completed = list.filter(r => {
          const s = String(r.status || '').toLowerCase();
          if (group === 'elearning'){
            // eLearning completion means a passing score (80+) and not expired.
            return s === 'approved' || s === 'expiring soon';
          }
          return s === 'complete' || s === 'approved' || s === 'submitted' || s === 'expiring';
        }).length;
        return { completed, total };
      }

      function computeExpiryCounts(group){
        const list = requirements.filter(r => r.group === group);
        const expired = list.filter(r => String(r.status || '').toLowerCase() === 'expired').length;
        const expiring = list.filter(r => {
          const s = String(r.status || '').toLowerCase();
          return s === 'expiring' || s === 'expiring soon';
        }).length;
        return { expired, expiring };
      }

      function computeIncomplete(group){
        const list = requirements.filter(r => r.group === group);
        return list.filter(r => {
          const s = String(r.status || '').toLowerCase();
          if (group === 'elearning'){
            return s === 'not submitted';
          }
          return !['complete','approved','submitted','expiring','expired'].includes(s);
        }).length;
      }

      function setProgress(id, group){
        const el = document.getElementById(id);
        if (!el) return;
        const { completed, total } = computeProgress(group);
        el.textContent = `${completed}/${total}`;
      }

      function setExpiryInfo(id, group){
        const el = document.getElementById(id);
        if (!el) return;
        const { expired, expiring } = computeExpiryCounts(group);
        if (!expired && !expiring){
          el.className = 'small text-success mb-2';
          el.textContent = 'No items expired or expiring soon';
          return;
        }
        const parts = [];
        if (expired) parts.push(`${expired} expired`);
        if (expiring) parts.push(`${expiring} expiring soon`);
        el.className = 'small text-danger mb-2';
        el.textContent = parts.join(' • ');
      }

      function setIncompleteInfo(id, group){
        const el = document.getElementById(id);
        if (!el) return;
        const count = computeIncomplete(group);
        if (!count){
          el.className = 'small text-success mb-2';
          el.textContent = 'All items submitted or complete';
          return;
        }
        el.className = 'small text-danger mb-2';
        el.textContent = `${count} incomplete`;
      }

      function renderCards(){
        setProgress('elearningProgress', 'elearning');
        setProgress('cpnwProgress', 'cpnw');
        setProgress('edProgress', 'ed');
        setProgress('hcProgress', 'hc');
        setExpiryInfo('elearningExpiryInfo', 'elearning');
        setExpiryInfo('cpnwExpiryInfo', 'cpnw');
        setExpiryInfo('edExpiryInfo', 'ed');
        setExpiryInfo('hcExpiryInfo', 'hc');
        setIncompleteInfo('elearningIncompleteInfo', 'elearning');
        setIncompleteInfo('cpnwIncompleteInfo', 'cpnw');
        setIncompleteInfo('edIncompleteInfo', 'ed');
        setIncompleteInfo('hcIncompleteInfo', 'hc');
      }

      renderCards();

      // Modals (list -> detail)
      const listModalEl = document.getElementById('studentReqModal');
      const listModal = listModalEl ? new bootstrap.Modal(listModalEl) : null;
      const listLabel = document.getElementById('studentReqModalLabel');
      const listSub = document.getElementById('studentReqModalSub');
      const listBody = document.getElementById('studentReqTableBody');
      const listSearch = document.getElementById('studentReqSearch');
      const pageSizeSelect = document.getElementById('studentReqPageSize');
      const pageInfo = document.getElementById('studentReqPageInfo');
      const prevBtn = document.getElementById('studentReqPrev');
      const nextBtn = document.getElementById('studentReqNext');

      const detailModalEl = document.getElementById('studentReqDetailModal');
      const detailModal = detailModalEl ? new bootstrap.Modal(detailModalEl) : null;
      const detailLabel = document.getElementById('studentReqDetailModalLabel');
      const detailMeta = document.getElementById('studentReqDetailMeta');
      const detailTypeLabel = document.getElementById('studentReqDetailTypeLabel');
      const detailInstructions = document.getElementById('studentReqDetailInstructions');
      const detailSaved = document.getElementById('studentReqDetailSaved');
      const detailError = document.getElementById('studentReqDetailError');
      const submissionWrap = document.getElementById('studentReqSubmissionWrap');
      const uploadWrap = document.getElementById('studentReqUploadWrap');
      const elearningLaunchWrap = document.getElementById('elearningLaunchWrap');
      const elearningLaunchBtn = document.getElementById('elearningLaunchBtn');
      const elearningStatusWrap = document.getElementById('elearningStatusWrap');
      const elearningStatusSummary = document.getElementById('elearningStatusSummary');
      const elearningStatusDetails = document.getElementById('elearningStatusDetails');
      const submissionOptionsWrap = document.getElementById('studentSubmissionOptions');
      const subRadios = document.querySelectorAll('input[name="studentSubmission"]');
      const subCompletedFields = document.getElementById('studentSubCompletedFields');
      const subSeriesFields = document.getElementById('studentSubSeriesFields');
      const subOtherFields = document.getElementById('studentSubOtherFields');
      const subCompletedDate = document.getElementById('studentCompletedDate');
      const subSeriesStart = document.getElementById('studentSeriesStart');
      const subSeriesDue = document.getElementById('studentSeriesDue');
      const subCompletedLabel = document.querySelector('label[for="studentSubCompleted"]');
      const subSeriesLabel = document.querySelector('label[for="studentSubSeries"]');
      const subOtherLabel = document.querySelector('label[for="studentSubOther"]');
      const subCompletedDateLabel = document.querySelector('label[for="studentCompletedDate"]');
      const subSeriesStartLabel = document.querySelector('label[for="studentSeriesStart"]');
      const subSeriesDueLabel = document.querySelector('label[for="studentSeriesDue"]');
      const subOtherRadio = document.getElementById('studentSubOther');
      const subOtherWrap = subOtherRadio?.closest('.form-check');
      const subSeriesDueWrap = subSeriesDue?.closest('.col-12');
      const defaultSubCompletedLabel = subCompletedLabel?.textContent || 'Vaccinated / Completed';
      const defaultSubSeriesLabel = subSeriesLabel?.textContent || 'Series in progress';
      const defaultSubOtherLabel = subOtherLabel?.textContent || 'Other';
      const defaultSubCompletedDateLabel = subCompletedDateLabel?.textContent || 'Vaccination / completion date';
      const defaultSubSeriesStartLabel = subSeriesStartLabel?.textContent || 'Series start';
      const defaultSubSeriesDueLabel = subSeriesDueLabel?.textContent || 'Next dose due';
      const subOtherNotes = document.getElementById('studentOtherNotes');
      const criminalDisclosureWrap = document.getElementById('criminalDisclosureWrap');
      const criminalDisclosureDates = document.getElementById('criminalDisclosureDates');
      const criminalDisclosureAdd = document.getElementById('criminalDisclosureAdd');
      const criminalDisclosureDate0 = document.getElementById('criminalDisclosureDate0');
      const criminalDisclosureDownload = document.getElementById('criminalDisclosureDownload');
      const criminalDisclosureDownloadWrap = document.getElementById('criminalDisclosureDownloadWrap');
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
      const msgList = document.getElementById('studentReqMessages');
      const msgInput = document.getElementById('studentReqMessageInput');
      const msgSend = document.getElementById('studentReqMessageSend');
      const msgToEducation = document.getElementById('msgToEducation');
      const msgToCpnw = document.getElementById('msgToCpnw');
      const msgToHealthcare = document.getElementById('msgToHealthcare');
      const notesEl = document.getElementById('studentReqNotes');
      const filesEl = document.getElementById('studentReqFiles');
      const fileListEl = document.getElementById('studentReqFileList');
      const uploadedWrap = document.getElementById('studentReqUploadedWrap');
      const uploadedList = document.getElementById('studentReqUploadedList');
      const submitBtn = document.getElementById('studentReqSubmitBtn');

      let currentGroup = 'elearning';
      let reqPage = 1;
      let reqPageSize = Number(pageSizeSelect?.value || 10);
      let currentReqId = '';
      let currentMessages = [];
      const messageThreads = {};
      let currentRecipients = ['Student','CPNW Reviewer'];
      let disclosureExtraCount = 0;

      function groupTitle(group){
        if (group === 'elearning') return 'CPNW eLearning modules';
        if (group === 'cpnw') return 'CPNW requirements';
        if (group === 'ed') return 'Education requirements';
        if (group === 'hc') return 'Healthcare requirements';
        return 'Requirements';
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

      function renderDetailMeta(req, expOverride){
        if (!detailMeta) return;
        const exp = expOverride ? fmtDate(expOverride) : (req.expiration ? fmtDate(req.expiration) : '—');
        const due = req.due ? fmtDate(req.due) : '—';
        const freqLabel = req.frequency || '—';
        detailMeta.innerHTML = `${groupTitle(req.group)} • <span class="badge text-bg-secondary">${freqLabel}</span> • ${statusBadge(req.status)} • Exp: ${exp} • Due: ${due}`;
      }

      function resetDetailAlerts(){
        setAlert(detailSaved, '');
        setAlert(detailError, '');
      }

      function renderMessages(){
        if (!msgList) return;
        if (!currentMessages.length){
          msgList.innerHTML = '<div class="text-body-secondary small">No messages yet.</div>';
          return;
        }
        msgList.innerHTML = currentMessages.map(m => `
          <div class="mb-2">
            <div class="fw-semibold">${m.from}</div>
            <div class="small text-body-secondary">${m.at}${m.to ? ` • To: ${m.to.join(', ')}` : ''}</div>
            <div>${m.body}</div>
          </div>
        `).join('');
      }

      function setSubmissionMode(mode){
        [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
        if (mode === 'completed') subCompletedFields?.classList.remove('d-none');
        if (mode === 'series') subSeriesFields?.classList.remove('d-none');
        if (mode === 'other') subOtherFields?.classList.remove('d-none');
      }

      function renderUploadedFiles(req){
        if (!uploadedWrap || !uploadedList) return;
        const submissions = studentData.submissions || {};
        const files = Array.isArray(submissions[req.id]?.files) ? submissions[req.id].files : [];
        if (!files.length){
          uploadedWrap.classList.add('d-none');
          uploadedList.innerHTML = '';
          return;
        }
        uploadedWrap.classList.remove('d-none');
        uploadedList.innerHTML = files.map(name => `
          <li class="d-flex justify-content-between align-items-center gap-2">
            <span>${name}</span>
            <button class="btn btn-outline-secondary btn-sm" type="button" data-download-file="${encodeURIComponent(name)}">Download</button>
          </li>
        `).join('');
      }

      function isTdapRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('tetanus') && label.includes('pertussis');
      }

      function isHepBRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('hepatitis b');
      }

      function isCriminalDisclosureRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('criminal history disclosure');
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

      function downloadSeriesInProcessForm(){
        const content = [
          'CPNW Hepatitis B Series In Process Form',
          '',
          'Student name:',
          'Program:',
          '',
          'Series details:',
          '',
          'Signature:',
          'Date:'
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'CPNW-HepB-Series-In-Process.txt';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function resetDisclosureFields(){
        if (criminalDisclosureDate0) criminalDisclosureDate0.value = '';
        if (criminalDisclosureDates){
          const extras = criminalDisclosureDates.querySelectorAll('[data-disclosure-extra]');
          extras.forEach(el => el.remove());
        }
        disclosureExtraCount = 0;
        criminalDisclosureAdd?.classList.add('d-none');
      }

      function updateDisclosureAddVisibility(){
        if (!criminalDisclosureAdd || !criminalDisclosureDates) return;
        const inputs = Array.from(criminalDisclosureDates.querySelectorAll('input[type="date"]'));
        const lastInput = inputs[inputs.length - 1];
        if (lastInput && lastInput.value){
          criminalDisclosureAdd.classList.remove('d-none');
        }else{
          criminalDisclosureAdd.classList.add('d-none');
        }
      }

      function addDisclosureDateField(){
        if (!criminalDisclosureDates) return;
        disclosureExtraCount += 1;
        const fieldId = `criminalDisclosureExtra${disclosureExtraCount}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'col-12 col-md-6';
        wrapper.setAttribute('data-disclosure-extra', 'true');
        wrapper.innerHTML = `
          <label class="form-label small mb-1" for="${fieldId}">Disclosure Signature Date</label>
          <input type="date" class="form-control" id="${fieldId}">
        `;
        criminalDisclosureDates.appendChild(wrapper);
        const input = wrapper.querySelector('input[type="date"]');
        input?.addEventListener('input', updateDisclosureAddVisibility);
        updateDisclosureAddVisibility();
      }

      function disclosureBaseDate(){
        if (!criminalDisclosureDate0?.value) return null;
        const d = new Date(criminalDisclosureDate0.value);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      function updateDisclosureExpiration(req){
        const base = disclosureBaseDate();
        if (!base) return;
        const exp = new Date(base);
        exp.setFullYear(exp.getFullYear() + 1);
        requirements = requirements.map(r => r.id === req.id ? { ...r, status: 'approved' } : r);
        req.status = 'approved';
        renderCards();
        renderDetailMeta(req, exp);
      }

      function downloadDisclosureForm(){
        const content = [
          'CPNW Criminal History Disclosure Form',
          '',
          'Student name:',
          'Program:',
          'School:',
          '',
          'Disclosure details:',
          '',
          'Signature:',
          'Date:'
        ].join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'CPNW-Criminal-History-Disclosure-Form.txt';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function applySubmissionTemplate(req){
        const isTdap = isTdapRequirement(req);
        const isHepB = isHepBRequirement(req);
        const isCriminal = isCriminalDisclosureRequirement(req);
        if (subCompletedLabel) subCompletedLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedLabel;
        if (subSeriesLabel) subSeriesLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesLabel;
        if (subOtherLabel) subOtherLabel.textContent = defaultSubOtherLabel;
        if (subCompletedDateLabel) subCompletedDateLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedDateLabel;
        if (subSeriesStartLabel) subSeriesStartLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesStartLabel;
        if (subSeriesDueLabel) subSeriesDueLabel.textContent = defaultSubSeriesDueLabel;
        subOtherWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB);
        subSeriesDueWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB);
        submissionOptionsWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB);
        criminalDisclosureWrap?.classList.toggle('d-none', !isCriminal);
        criminalDisclosureDownloadWrap?.classList.toggle('d-none', !isCriminal);
        hepBSubmissionWrap?.classList.toggle('d-none', !isHepB);
        if (isTdap){
          subCompletedFields?.classList.remove('d-none');
          subSeriesFields?.classList.remove('d-none');
          subOtherFields?.classList.add('d-none');
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
        }else if (isCriminal){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetDisclosureFields();
          hepBSubmissionWrap?.classList.add('d-none');
        }else if (isHepB){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetHepBFields();
        }else{
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
        }
      }

      function configureRecipients(group){
        const allowCpnw = group === 'cpnw';
        if (msgToEducation){
          msgToEducation.disabled = false;
          msgToEducation.checked = false;
        }
        if (msgToHealthcare){
          msgToHealthcare.disabled = false;
          msgToHealthcare.checked = false;
        }
        if (msgToCpnw){
          msgToCpnw.disabled = !allowCpnw;
          msgToCpnw.checked = false;
        }
        currentRecipients = [];
        if (msgToEducation?.checked) currentRecipients.push('Education');
        if (allowCpnw && msgToCpnw?.checked) currentRecipients.push('CPNW Reviewer');
        if (msgToHealthcare?.checked) currentRecipients.push('Healthcare');
      }

      function openReqList(group){
        if (!listModal) return;
        currentGroup = group;
        reqPage = 1;
        if (listSearch) listSearch.value = '';
        renderReqList();
        listModal.show();
      }

      function currentRequirements(){
        return requirements.filter(r => r.group === currentGroup);
      }

      function defaultThreadFor(req){
        if (req.group === 'elearning'){
          return [
            { from:'Coordinator', at:'2025-02-10', body:'If you need help launching the module, contact your program coordinator.' }
          ];
        }
        return [
          { from:'Coordinator', at:'2025-02-10', body:'Please upload the latest documentation for this requirement.' },
          { from:'Student', at:'2025-02-11', body:'Uploaded the file on 2/11. Please confirm receipt.' }
        ];
      }

      function openReqDetail(id){
        if (!detailModal) return;
        const req = requirements.find(r => r.id === id);
        if (!req) return;
        currentReqId = id;

        resetDetailAlerts();
        if (detailTypeLabel) detailTypeLabel.textContent = `${req.type || 'Requirement'} Requirement`;
        if (detailLabel) detailLabel.textContent = req.label;
        renderDetailMeta(req);
        if (detailInstructions) detailInstructions.innerHTML = req.instructionsHTML || '<p class="text-body-secondary">No instructions provided.</p>';
        if (notesEl) notesEl.value = '';
        if (filesEl) filesEl.value = '';
        if (fileListEl) fileListEl.innerHTML = '';
        if (uploadedList) uploadedList.innerHTML = '';
        subRadios.forEach(r => { r.checked = false; });
        [subCompletedDate, subSeriesStart, subSeriesDue, subOtherNotes].forEach(el => { if (el) el.value = ''; });
        [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
        applySubmissionTemplate(req);
        if (isCriminalDisclosureRequirement(req) && criminalDisclosureDate0){
          const today = new Date();
          const iso = today.toISOString().slice(0, 10);
          criminalDisclosureDate0.value = iso;
          updateDisclosureAddVisibility();
          updateDisclosureExpiration(req);
        }

        const isElearning = req.group === 'elearning';
        if (submitBtn) submitBtn.classList.toggle('d-none', isElearning);
        if (submissionWrap) submissionWrap.classList.toggle('d-none', isElearning);
        if (uploadWrap) uploadWrap.classList.toggle('d-none', isElearning);
        if (elearningLaunchWrap) elearningLaunchWrap.classList.toggle('d-none', !isElearning);
        if (elearningStatusWrap) elearningStatusWrap.classList.toggle('d-none', !isElearning);
        currentMessages = messageThreads[id]
          ? messageThreads[id]
          : (messageThreads[id] = defaultThreadFor(req));
        renderMessages();
        configureRecipients(req.group);
        renderUploadedFiles(req);

        if (isElearning){
          const status = String(req.status || '').toLowerCase();
          const bestScoreVal = Number(req.bestScore);
          const lastScoreVal = Number(req.lastScore);
          const hasAttempts = Array.isArray(req.attempts) && req.attempts.length > 0;
          const passed = Number.isFinite(bestScoreVal) && bestScoreVal >= 80;
          const expiresOn = req.expiration instanceof Date ? req.expiration : null;
          const currentScore = Number.isFinite(bestScoreVal) ? bestScoreVal : (Number.isFinite(lastScoreVal) ? lastScoreVal : null);

          if (elearningStatusSummary){
            if (!hasAttempts){
              elearningStatusSummary.textContent = 'No attempts yet. Launch the module to begin.';
            }else if (!passed){
              elearningStatusSummary.textContent = 'Attempt recorded. Passing score is 80+.';
            }else if (status === 'expired'){
              elearningStatusSummary.textContent = `Previously completed, but expired on ${expiresOn ? fmtDate(expiresOn) : '—'}.`;
            }else{
              elearningStatusSummary.textContent = `Completed${expiresOn ? ` • Expires ${fmtDate(expiresOn)}` : ''}`;
            }
          }

          if (elearningStatusDetails){
            const items = [];
            if (!hasAttempts){
              items.push('<li class="text-body-secondary">No attempts are on record.</li>');
            }else{
              if (currentScore !== null) items.push(`<li><span class="text-body-secondary">Score:</span> <span class="fw-semibold">${currentScore}</span></li>`);
              items.push(`<li><span class="text-body-secondary">Status:</span> <span class="fw-semibold">${passed ? (status === 'expired' ? 'Expired' : 'Passed') : 'Not passed'}</span></li>`);

              if (passed && expiresOn){
                items.push(`<li><span class="text-body-secondary">${status === 'expired' ? 'Expired:' : 'Expires:'}</span> <span class="fw-semibold">${fmtDate(expiresOn)}</span></li>`);
              }else if (passed){
                items.push('<li class="text-body-secondary">No expiration date on record.</li>');
              }else{
                items.push('<li class="text-body-secondary">No expiration until the module is passed with 80+.</li>');
              }
            }
            elearningStatusDetails.innerHTML = items.join('');
          }
        }else{
          if (elearningStatusSummary) elearningStatusSummary.textContent = '';
          if (elearningStatusDetails) elearningStatusDetails.innerHTML = '';
        }

        // Close list modal to mimic the review flow (list modal -> detail modal).
        if (listModalEl && detailModal){
          listModalEl.addEventListener('hidden.bs.modal', () => {
            detailModal.show();
          }, { once: true });
          listModal?.hide();
        }else{
          detailModal?.show();
        }
      }

      function renderReqList(){
        if (!listBody) return;
        const q = (listSearch?.value || '').toLowerCase().trim();
        const all = currentRequirements();
        const filtered = all.filter(r => {
          if (!q) return true;
          return `${r.label} ${r.type} ${r.status}`.toLowerCase().includes(q);
        });

        if (listLabel) listLabel.textContent = groupTitle(currentGroup);
        if (listSub) listSub.textContent = 'Select a requirement to view details and submit.';

        // Expiring/expired first, then incomplete, then submitted/complete.
        const order = { expired:0, 'expiring soon':1, expiring:2, 'not submitted':3, incomplete:4, submitted:5, approved:6, complete:7 };
        filtered.sort((a,b) => {
          const oa = order[String(a.status || '').toLowerCase()] ?? 99;
          const ob = order[String(b.status || '').toLowerCase()] ?? 99;
          if (oa != ob) return oa - ob;
          return String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity:'base' });
        });

        const total = filtered.length;
        reqPageSize = Number(pageSizeSelect?.value || reqPageSize || 10);
        const totalPages = Math.max(1, Math.ceil(total / reqPageSize));
        if (reqPage > totalPages) reqPage = totalPages;
        const start = (reqPage - 1) * reqPageSize;
        const end = Math.min(start + reqPageSize, total);
        const pageItems = filtered.slice(start, end);

        listBody.innerHTML = pageItems.map(r => {
          const exp = r.expiration ? fmtDate(r.expiration) : '—';
          const due = r.due ? fmtDate(r.due) : '—';
          return `
            <tr>
              <td class="fw-semibold">${r.label}</td>
              <td>${r.frequency || '—'}</td>
              <td>${statusBadge(r.status)}</td>
              <td class="text-nowrap">${exp}</td>
              <td class="text-nowrap">${due}</td>
              <td class="text-end"><button class="btn btn-outline-secondary btn-sm" type="button" data-view-req="${r.id}">View</button></td>
            </tr>
          `;
        }).join('') || `<tr><td colspan="6" class="text-body-secondary small">No results.</td></tr>`;

        if (pageInfo){
          pageInfo.textContent = total ? `Showing ${start + 1}–${end} of ${total}` : 'No results';
        }
        if (prevBtn && nextBtn){
          prevBtn.disabled = reqPage <= 1;
          nextBtn.disabled = end >= total;
        }
      }

      function updateFileList(){
        if (!fileListEl || !filesEl) return;
        const names = Array.from(filesEl.files || []).map(f => f.name);
        fileListEl.innerHTML = names.length ? names.map(n => `<li>${n}</li>`).join('') : '<li class="text-body-secondary">No files selected.</li>';
      }

      function downloadUploadedFile(name){
        const safeName = name || 'document.txt';
        const content = `Demo file download: ${safeName}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function submitCurrent(){
        resetDetailAlerts();
        const req = requirements.find(r => r.id === currentReqId);
        if (!req){
          setAlert(detailError, 'Unable to submit: requirement not found.');
          return;
        }

        const notes = (notesEl?.value || '').trim();
        const files = Array.from(filesEl?.files || []).map(f => f.name);
        const nextStatus = req.group === 'elearning' ? 'complete' : 'submitted';
        const submissionMode = isTdapRequirement(req)
          ? 'tdap'
          : (isCriminalDisclosureRequirement(req)
            ? 'criminal_disclosure'
            : (isHepBRequirement(req)
              ? 'hep_b'
              : (Array.from(subRadios).find(r => r.checked)?.value || '')));

        const submissionPayload = {
          mode: submissionMode,
          completedDate: subCompletedDate?.value || '',
          seriesStart: subSeriesStart?.value || '',
          seriesDue: subSeriesDue?.value || '',
          otherNotes: subOtherNotes?.value || '',
          disclosureDates: isCriminalDisclosureRequirement(req) && criminalDisclosureDates
            ? Array.from(criminalDisclosureDates.querySelectorAll('input[type="date"]')).map(el => el.value).filter(Boolean)
            : [],
          hepB: isHepBRequirement(req) ? {
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
          } : null
        };

        const nextStudentData = loadStudentData();
        nextStudentData.submissions = nextStudentData.submissions || {};
        nextStudentData.submissions[req.id] = {
          submittedAt: new Date().toISOString(),
          notes,
          files,
          submission: submissionPayload
        };
        saveStudentData(nextStudentData);
        studentData = nextStudentData;

        requirements = requirements.map(r => r.id === req.id ? { ...r, status: nextStatus } : r);
        renderCards();
        setAlert(detailSaved, 'Submitted.');

        window.setTimeout(() => {
          detailModal?.hide();
          if (detailModalEl && listModal){
            detailModalEl.addEventListener('hidden.bs.modal', () => {
              openReqList(req.group);
            }, { once: true });
          }else{
            openReqList(req.group);
          }
          // Re-open the list modal so the student sees their updated status.
        }, 650);
      }

      document.addEventListener('click', (e) => {
        const openBtn = e.target.closest('[data-open-reqs]');
        if (openBtn){
          openReqList(openBtn.dataset.openReqs);
          return;
        }
        const viewBtn = e.target.closest('[data-view-req]');
        if (viewBtn){
          openReqDetail(viewBtn.dataset.viewReq);
          return;
        }
        const downloadBtn = e.target.closest('[data-download-file]');
        if (downloadBtn){
          const name = decodeURIComponent(downloadBtn.dataset.downloadFile || '');
          downloadUploadedFile(name);
        }
      });

      listSearch?.addEventListener('input', () => { reqPage = 1; renderReqList(); });
      pageSizeSelect?.addEventListener('change', () => { reqPage = 1; renderReqList(); });
      prevBtn?.addEventListener('click', () => { reqPage = Math.max(1, reqPage - 1); renderReqList(); });
      nextBtn?.addEventListener('click', () => { reqPage = reqPage + 1; renderReqList(); });

      subRadios.forEach(radio => {
        radio.addEventListener('change', () => setSubmissionMode(radio.value));
      });

      hepBOptionTiter?.addEventListener('change', updateHepBMainOption);
      hepBOptionNoTiter?.addEventListener('change', updateHepBMainOption);
      hepBReasonNonConverter?.addEventListener('change', updateHepBReason);
      hepBReasonSeriesInProcess?.addEventListener('change', updateHepBReason);
      hepBReasonHistory?.addEventListener('change', updateHepBReason);
      hepBReasonHealth?.addEventListener('change', updateHepBReason);
      hepBHealthReasonInput?.addEventListener('input', updateHepBHealthReasonCount);
      hepBSeriesInProcessDownload?.addEventListener('click', downloadSeriesInProcessForm);
      hepBNcSeries1Two?.addEventListener('change', () => setSeriesFields(hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, false));
      hepBNcSeries1Three?.addEventListener('change', () => setSeriesFields(hepBNcSeries1TwoFields, hepBNcSeries1ThreeFields, true));
      hepBNcSeries2Two?.addEventListener('change', () => setSeriesFields(hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, false));
      hepBNcSeries2Three?.addEventListener('change', () => setSeriesFields(hepBNcSeries2TwoFields, hepBNcSeries2ThreeFields, true));
      hepBIpSeries1Two?.addEventListener('change', () => setSeriesFields(hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields, false));
      hepBIpSeries1Three?.addEventListener('change', () => setSeriesFields(hepBIpSeries1TwoFields, hepBIpSeries1ThreeFields, true));

      criminalDisclosureDate0?.addEventListener('input', () => {
        updateDisclosureAddVisibility();
        const req = requirements.find(r => r.id === currentReqId);
        if (req && isCriminalDisclosureRequirement(req)){
          updateDisclosureExpiration(req);
        }
      });
      criminalDisclosureAdd?.addEventListener('click', addDisclosureDateField);
      criminalDisclosureDownload?.addEventListener('click', downloadDisclosureForm);

      filesEl?.addEventListener('change', updateFileList);
      submitBtn?.addEventListener('click', submitCurrent);
      elearningLaunchBtn?.addEventListener('click', () => {
        const req = requirements.find(r => r.id === currentReqId);
        if (!req) return;

        alert('This is a demo. In a real scenario the eLearning module would open in a new tab and the score would be recorded and posted to the account automatically after completion.');

        const nextStudentData = loadStudentData();
        nextStudentData.elearning = nextStudentData.elearning || {};
        const existing = nextStudentData.elearning[req.id] && typeof nextStudentData.elearning[req.id] === 'object'
          ? nextStudentData.elearning[req.id]
          : {};

        const attempts = Array.isArray(existing.attempts) ? existing.attempts.slice() : [];
        // Demo scoring: random 60–100.
        const score = 60 + Math.floor(Math.random() * 41);
        attempts.push({ at: new Date().toISOString(), score });

        const passed = score >= 80;
        if (passed){
          const passedAt = new Date();
          const expiresAt = new Date(passedAt);
          expiresAt.setDate(expiresAt.getDate() + 365);
          nextStudentData.elearning[req.id] = { attempts, passedAt: passedAt.toISOString(), expiresAt: expiresAt.toISOString() };
        }else{
          nextStudentData.elearning[req.id] = { ...existing, attempts, passedAt: existing.passedAt || '', expiresAt: existing.expiresAt || '' };
        }

        saveStudentData(nextStudentData);
        studentData = nextStudentData;
        requirements = rebuildRequirements();
        renderCards();

        const updated = requirements.find(r => r.id === req.id);
        if (updated){
          // Refresh status panel in-place.
          openReqDetail(updated.id);
        }

      });

      msgSend?.addEventListener('click', () => {
        const body = (msgInput?.value || '').trim();
        if (!body) return;
        const to = [];
        const allowCpnw = currentGroup === 'cpnw';
        if (msgToEducation?.checked) to.push('Education');
        if (allowCpnw && msgToCpnw?.checked) to.push('CPNW Reviewer');
        if (msgToHealthcare?.checked) to.push('Healthcare');
        if (!to.length){
          alert('Please choose at least one recipient.');
          return;
        }
        currentMessages.push({ from:'Student', at: new Date().toLocaleString(), body, to });
        if (currentReqId) messageThreads[currentReqId] = currentMessages;
        if (msgInput) msgInput.value = '';
        renderMessages();
      });

      detailModalEl?.addEventListener('hidden.bs.modal', () => {
        if (notesEl) notesEl.value = '';
        if (filesEl) filesEl.value = '';
        if (fileListEl) fileListEl.innerHTML = '';
        if (elearningStatusSummary) elearningStatusSummary.textContent = '';
        if (elearningStatusDetails) elearningStatusDetails.innerHTML = '';
        currentReqId = '';
        resetDetailAlerts();
      });

    })();
  
