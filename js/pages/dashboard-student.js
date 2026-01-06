
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
      const requirementsStore = (window.CPNW && window.CPNW.requirementsStore) ? window.CPNW.requirementsStore : null;
      const demoPeople = (window.CPNW && Array.isArray(window.CPNW.demoPeople)) ? window.CPNW.demoPeople : [];
      const demoPerson = currentUser
        ? demoPeople.find(p => p.email.toLowerCase() === currentUser.email.toLowerCase())
        : null;
      const STUDENT_DATA_KEY = currentUser?.email
        ? `cpnw-student-data-${currentUser.email.toLowerCase()}`
        : 'cpnw-student-data-v1';
      const ASSIGNMENTS_KEY = 'cpnw-assignments-v1';

      const assignmentTableBody = document.getElementById('studentAssignmentsBody');
      const notificationsList = document.getElementById('studentNotifications');

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
        if (n.includes('resp')) return 'resp';
        if (n.includes('medassistant') || n.includes('medassist')) return 'med';
        if (n.includes('sonography') || n.includes('sono') || n.includes('dms')) return 'sono';
        return '';
      }

      const programName = currentUser?.programs?.[0] || currentUser?.profile?.program || '';
      const programKey = programKeyFromName(programName);
      const programPackages = {
        bsn: { background: 'CPNW: Independent Background Check', watch: 'CPNW: Independent WATCH' },
        adn: { background: 'CPNW: Checkr Background Check', watch: 'CPNW: CPNW WATCH' },
        surg: { background: 'CPNW: Checkr Background Check', watch: 'CPNW: Independent WATCH' },
        rad: { background: 'CPNW: Independent Background Check', watch: 'CPNW: CPNW WATCH' },
        resp: { background: 'CPNW: Checkr Background Check', watch: 'CPNW: CPNW WATCH' },
        med: { background: 'CPNW: Checkr Background Check', watch: 'CPNW: Independent WATCH' },
        sono: { background: 'CPNW: Independent Background Check', watch: 'CPNW: Independent WATCH' }
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
          return { submissions: {}, elearning: {}, messages: {} };
        }
        const submissions = raw.submissions && typeof raw.submissions === 'object' && !Array.isArray(raw.submissions) ? raw.submissions : {};
        const elearning = raw.elearning && typeof raw.elearning === 'object' && !Array.isArray(raw.elearning) ? raw.elearning : {};
        const messages = raw.messages && typeof raw.messages === 'object' && !Array.isArray(raw.messages) ? raw.messages : {};
        return { submissions, elearning, messages };
      }

      function saveStudentData(next){
        saveJSON(STUDENT_DATA_KEY, next);
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

      function resolveStudentKeys(){
        const rosterMatch = (window.CPNW && typeof window.CPNW.findRosterEntry === 'function' && currentUser)
          ? window.CPNW.findRosterEntry({ email: currentUser.email }) || null
          : null;
        const ids = new Set([
          rosterMatch?.studentId,
          currentUser?.studentId,
          currentUser?.profile?.studentId
        ].filter(Boolean).map(String));
        const sids = new Set([
          rosterMatch?.sid,
          currentUser?.sid,
          currentUser?.profile?.sid
        ].filter(Boolean).map(String));
        return { ids, sids };
      }

      function assignmentStatusBadge(status){
        const norm = String(status || 'pending').toLowerCase();
        if (norm === 'approved') return '<span class="badge text-bg-success">Approved</span>';
        if (norm === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
        return '<span class="badge text-bg-secondary">Pending</span>';
      }

      function renderAssignmentsAndNotifications(){
        const { ids, sids } = resolveStudentKeys();
        const assignments = loadAssignments()
          .filter(a => (a.studentId && ids.has(String(a.studentId))) || (a.studentSid && sids.has(String(a.studentSid))))
          .sort((a, b) => {
            const aTime = a.start instanceof Date ? a.start.getTime() : 0;
            const bTime = b.start instanceof Date ? b.start.getTime() : 0;
            return bTime - aTime;
          });

        if (assignmentTableBody){
          assignmentTableBody.innerHTML = assignments.map(a => `
            <tr>
              <td class="fw-semibold">${a.location || '—'}</td>
              <td>${fmtDate(a.start) || '—'}</td>
              <td>${fmtDate(a.end) || '—'}</td>
              <td>${assignmentStatusBadge(a.status)}</td>
            </tr>
          `).join('') || '<tr><td colspan="4" class="text-body-secondary small">Assignments will appear here once scheduled.</td></tr>';
        }

        if (notificationsList){
          const notifications = [];
          assignments.forEach(a => {
            const status = String(a.status || 'pending').toLowerCase();
            if (status === 'rejected'){
              const reason = a.rejectionReason ? ` • ${a.rejectionReason}` : '';
              notifications.push({
                title: 'Assignment rejected',
                detail: `${a.location || 'Clinical site'}${reason}`,
                badge: 'Rejected',
                badgeClass: 'text-bg-danger',
                priority: 0
              });
              return;
            }
            if (status === 'pending'){
              const startLabel = a.start instanceof Date ? fmtDate(a.start) : 'TBD';
              notifications.push({
                title: 'Assignment pending approval',
                detail: `${a.location || 'Clinical site'} • Starts ${startLabel}`,
                badge: 'Pending',
                badgeClass: 'text-bg-secondary',
                priority: 1
              });
              return;
            }
            if (status === 'approved'){
              const startLabel = a.start instanceof Date ? fmtDate(a.start) : 'TBD';
              notifications.push({
                title: 'Assignment approved',
                detail: `${a.location || 'Clinical site'} • Starts ${startLabel}`,
                badge: 'Approved',
                badgeClass: 'text-bg-success',
                priority: 2
              });
            }
          });

          const visible = notifications
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 4);

          notificationsList.innerHTML = visible.length
            ? visible.map(note => `
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-semibold">${note.title}</div>
                  <p class="small text-body-secondary mb-0">${note.detail}</p>
                </div>
                <span class="badge ${note.badgeClass}">${note.badge}</span>
              </li>
            `).join('')
            : '<li class="list-group-item"><div class="text-body-secondary small">No notifications yet.</div></li>';
        }
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
        if (norm === 'in review') return '<span class="badge text-bg-warning text-dark">In Review</span>';
        if (norm === 'conditionally approved') return '<span class="badge text-bg-primary">Conditionally Approved</span>';
        if (norm === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
        if (norm === 'declination') return '<span class="badge text-bg-danger-subtle text-danger">Declination</span>';
        if (norm === 'expiring') return '<span class="badge text-bg-warning text-dark">Expiring</span>';
        if (norm === 'expiring soon') return '<span class="badge text-bg-warning text-dark">Expiring soon</span>';
        if (norm === 'expired') return '<span class="badge text-bg-danger">Expired</span>';
        if (norm === 'not submitted') return '<span class="badge text-bg-secondary">Not submitted</span>';
        return '<span class="badge text-bg-secondary">Incomplete</span>';
      }

      function toStoreStatus(status){
        const norm = String(status || '').toLowerCase();
        if (norm === 'approved' || norm === 'complete') return 'Approved';
        if (norm === 'submitted') return 'Submitted';
        if (norm === 'in review') return 'In Review';
        if (norm === 'conditionally approved') return 'Conditionally Approved';
        if (norm === 'rejected') return 'Rejected';
        if (norm === 'declination') return 'Declination';
        if (norm === 'expiring') return 'Expiring';
        if (norm === 'expiring soon') return 'Expiring Soon';
        if (norm === 'expired') return 'Expired';
        return 'Not Submitted';
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
          const isVaricella = String(label || '').toLowerCase().includes('varicella');
          const isMmr = String(label || '').toLowerCase().includes('measles') && String(label || '').toLowerCase().includes('mumps') && String(label || '').toLowerCase().includes('rubella');
          const isInfluenza = String(label || '').toLowerCase().includes('influenza');
          const isTuberculin = String(label || '').toLowerCase().includes('tuberculin');
          const isBls = String(label || '').toLowerCase().includes('bls') && String(label || '').toLowerCase().includes('provider');
          const isCovid = String(label || '').toLowerCase().includes('covid');
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
          const varicellaInstructions = [
            '<p>You must meet the Varicella requirement by either providing two vaccination records or proof of immunity through a titer blood draw.</p>',
            '<p><strong>Note:</strong> A verbal or written history of having had chickenpox is not accepted as proof of immunity.</p>',
            '<p class="fw-semibold mb-1">Option 1: Vaccination Dates</p>',
            '<ul><li>Submit documentation showing two doses of the Varicella vaccine.</li></ul>',
            '<p class="fw-semibold mb-1">Option 2: Proof of Immunity by Titer</p>',
            '<ul><li>Submit a positive Varicella titer result from a blood draw.</li></ul>',
            '<p class="mb-0"><strong>Important:</strong> If the titer result is negative or non-immune, you must receive a booster dose.</p>'
          ].join('');
          const mmrInstructions = [
            '<p>The MMR (Measles, Mumps, and Rubella) or MMRV (Measles, Mumps, Rubella, and Varicella) vaccine is required for clinical participation. You meet this requirement by providing vaccination records and proof of immunity through titers.</p>',
            '<p class="fw-semibold mb-1">Option 1: Vaccination</p>',
            '<p>Submit: Two doses of the MMR or MMRV vaccine.</p>',
            '<p class="fw-semibold mb-1">Option 2: Proof of Immunity by Titers</p>',
            '<p>Submit lab results showing positive titers for each of the following: Measles (Rubeola), Mumps, Rubella.</p>',
            '<p>Most labs will draw one blood sample and report three separate results (plus Varicella, if tested).</p>',
            '<p class="mb-0"><strong>Important:</strong> If any one of the three titers are negative or non-immune, you must receive a booster dose for that component.</p>'
          ].join('');
          const influenzaInstructions = [
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
          const tuberculinInstructions = [
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
          const blsInstructions = [
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
          const covidInstructions = [
            '<p>All students and faculty are required to upload their full COVID-19 vaccination history.</p>',
            '<p>Please note: Some clinical sites may update their policies and require an annual COVID-19 vaccination/booster as a condition of participation.</p>',
            '<p class="fw-semibold mb-1">Option 1: No Vaccination History</p>',
            '<p>If you have never received a COVID-19 vaccine, check the option labeled “NA Check Box”.</p>',
            '<p class="fw-semibold mb-1">Option 2: Vaccination Documentation</p>',
            '<p>Submit all available vaccination record that includes:</p>',
            '<ul>',
            '<li>Vaccine manufacturer (e.g., Pfizer, Moderna, Johnson & Johnson)</li>',
            '<li>Dates associated with receiving either a one-dose or two-dose series</li>',
            '<li>The date(s) of administration, including subsequent boosters, if applicable</li>',
            '</ul>'
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
              : (isCriminalDisclosure
                ? disclosureInstructions
                : (isVaricella
                    ? varicellaInstructions
                    : (isMmr
                      ? mmrInstructions
                      : (isInfluenza
                        ? influenzaInstructions
                        : (isTuberculin
                          ? tuberculinInstructions
                          : (isBls
                            ? blsInstructions
                            : (isCovid
                              ? covidInstructions
                              : `<p>Upload the required documentation for ${label}.</p>`)))))))
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

      renderAssignmentsAndNotifications();

      function rebuildRequirements(){
        // Non-eLearning student submissions (files/notes) count as Submitted.
        const submissions = studentData.submissions || {};
        const list = buildRequirements().map(r => {
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
        if (requirementsStore && currentUser?.email){
          const studentContext = { email: currentUser.email, sid: currentUser.sid || '' };
          const studentKey = requirementsStore.resolveStudentKey(studentContext);
          return list.map(r => {
            const stored = requirementsStore.getRecord(studentKey, r.label);
            if (stored?.status){
              const expOverride = stored.meta?.expiration;
              if (expOverride && r.frequency !== 'Once'
                && (stored.status === 'Approved' || stored.status === 'Conditionally Approved')){
                const expDate = new Date(expOverride);
                if (!Number.isNaN(expDate.getTime())){
                  return { ...r, status: stored.status, expiration: expDate };
                }
              }
              return { ...r, status: stored.status };
            }
            const nextStatus = toStoreStatus(r.status);
            requirementsStore.setStatus(studentContext, r.label, nextStatus, {
              source: 'student-data',
              updatedAt: new Date().toISOString()
            });
            return { ...r, status: nextStatus };
          });
        }
        return list;
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
          return ['complete','approved','submitted','in review','conditionally approved','expiring','expiring soon'].includes(s);
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
          return !['complete','approved','submitted','in review','conditionally approved','expiring','expiring soon'].includes(s);
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
      const listHead = document.getElementById('studentReqTableHead');
      const listBody = document.getElementById('studentReqTableBody');
      const listSearch = document.getElementById('studentReqSearch');
      const pageSizeSelect = document.getElementById('studentReqPageSize');
      const pageInfo = document.getElementById('studentReqPageInfo');
      const prevBtn = document.getElementById('studentReqPrev');
      const nextBtn = document.getElementById('studentReqNext');
      const reviewerDisplayName = demoPeople.find(p => p.role === 'cpnw-reviewer')?.name || 'CPNW Reviewer';

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

      if (detailModalEl && listModal){
        detailModalEl.addEventListener('hidden.bs.modal', () => {
          if (listModalEl && !listModalEl.classList.contains('show')){
            listModal.show();
          }
        });
      }

      let currentGroup = 'elearning';
      let reqPage = 1;
      let reqPageSize = Number(pageSizeSelect?.value || 10);
      let currentReqId = '';
      let currentMessages = [];
      const messageThreads = {};
      let currentRecipients = ['Student','CPNW Reviewer'];
      let disclosureExtraCount = 0;
      let influenzaExtraCount = 0;
      let covidExtraCount = 0;
      let mmrBoosterCounts = { measles: 0, mumps: 0, rubella: 0 };
      let reqSort = { key: 'label', dir: 'asc' };

      function groupTitle(group){
        if (group === 'elearning') return 'CPNW eLearning modules';
        if (group === 'cpnw') return 'CPNW requirements';
        if (group === 'ed') return 'Education requirements';
        if (group === 'hc') return 'Healthcare requirements';
        return 'Requirements';
      }

      function reviewerNameFor(req){
        if (currentGroup !== 'cpnw') return '—';
        const status = String(req?.status || '').toLowerCase();
        if (['approved','conditionally approved','rejected','in review'].includes(status)){
          return reviewerDisplayName;
        }
        return '—';
      }

      function renderReqHead(){
        if (!listHead) return;
        if (currentGroup === 'cpnw'){
          const headers = [
            { key: 'label', label: 'Requirement Name' },
            { key: 'status', label: 'Status' },
            { key: 'expiration', label: 'Expiration', nowrap: true },
            { key: 'type', label: 'Type' },
            { key: 'frequency', label: 'Frequency' },
            { key: 'reviewer', label: 'Reviewer (name)' }
          ];
          listHead.innerHTML = `<tr>${headers.map(h => {
            const active = reqSort.key === h.key;
            const dir = reqSort.dir === 'asc' ? 'ascending' : 'descending';
            const indicator = active ? ` <span class="small text-body-secondary">${reqSort.dir === 'asc' ? '&#9650;' : '&#9660;'}</span>` : '';
            return `
              <th scope="col"${h.nowrap ? ' class="text-nowrap"' : ''} aria-sort="${active ? dir : 'none'}">
                <button class="btn btn-link p-0 text-decoration-none text-body-secondary" type="button" data-req-sort="${h.key}">
                  ${h.label}${indicator}
                </button>
              </th>
            `;
          }).join('')}</tr>`;
          return;
        }

        listHead.innerHTML = `
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">Frequency</th>
            <th scope="col">Status</th>
            <th scope="col" class="text-nowrap">Expiration</th>
            <th scope="col" class="text-nowrap">Due</th>
            <th scope="col" class="text-end">View</th>
          </tr>
        `;
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

      function isVaricellaRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('varicella');
      }

      function isMmrRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('measles') && label.includes('mumps') && label.includes('rubella');
      }

      function isInfluenzaRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('influenza');
      }

      function isTuberculinRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('tuberculin');
      }

      function isBlsRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('bls') && label.includes('provider');
      }

      function isCovidRequirement(req){
        const label = String(req?.label || '').toLowerCase();
        return req?.group === 'cpnw' && label.includes('covid');
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
          const addBtn = group.querySelector('[data-mmr-add]');
          addBtn?.classList.add('d-none');
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
        if (showTiter){
          updateMmrBoosterVisibility('measles');
          updateMmrBoosterVisibility('mumps');
          updateMmrBoosterVisibility('rubella');
        }
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
        if (!addBtn) return;
        const rows = Array.from(group.querySelectorAll('[data-mmr-row]'));
        const last = rows[rows.length - 1];
        if (!last){
          addBtn.classList.add('d-none');
          return;
        }
        const hasNegative = !!last.querySelector('input[type="radio"][value="neg"]:checked');
        addBtn.classList.toggle('d-none', !hasNegative);
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
        group.insertBefore(row, addBtn);
        row.querySelectorAll('input[type="radio"]').forEach(input => {
          input.addEventListener('change', () => updateMmrBoosterVisibility(type));
        });
        addBtn?.classList.add('d-none');
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

      function updateTuberculinOption(){
        const showTwoStep = !!tuberculinOptionTwoStep?.checked;
        const showIgra = !!tuberculinOptionIgra?.checked;
        const showHistory = !!tuberculinOptionHistory?.checked;
        tuberculinTwoStepFields?.classList.toggle('d-none', !showTwoStep);
        tuberculinIgraFields?.classList.toggle('d-none', !showIgra);
        tuberculinHistoryFields?.classList.toggle('d-none', !showHistory);
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

      function downloadTuberculinForm(){
        const content = [
          'TB Check Form',
          '',
          'Student name:',
          'Program:',
          'School:',
          '',
          'Screening details:',
          '',
          'Provider signature:',
          'Date:'
        ].join('\n');
        const blob = new Blob([content], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'TBCheckForm.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function applySubmissionTemplate(req){
        const isTdap = isTdapRequirement(req);
        const isHepB = isHepBRequirement(req);
        const isCriminal = isCriminalDisclosureRequirement(req);
        const isVaricella = isVaricellaRequirement(req);
        const isMmr = isMmrRequirement(req);
        const isInfluenza = isInfluenzaRequirement(req);
        const isTuberculin = isTuberculinRequirement(req);
        const isBls = isBlsRequirement(req);
        const isCovid = isCovidRequirement(req);
        if (subCompletedLabel) subCompletedLabel.textContent = isTdap ? 'Initial Tdap date' : defaultSubCompletedLabel;
        if (subSeriesLabel) subSeriesLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesLabel;
        if (subOtherLabel) subOtherLabel.textContent = defaultSubOtherLabel;
        if (subCompletedDateLabel) subCompletedDateLabel.textContent = isTdap ? 'Initial Tdap date' : (isBls ? 'Date of Issue' : defaultSubCompletedDateLabel);
        if (subSeriesStartLabel) subSeriesStartLabel.textContent = isTdap ? 'Td/Tdap subsequent dose date' : defaultSubSeriesStartLabel;
        if (subSeriesDueLabel) subSeriesDueLabel.textContent = defaultSubSeriesDueLabel;
        subOtherWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isBls || isCovid);
        subSeriesDueWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isBls || isCovid);
        submissionOptionsWrap?.classList.toggle('d-none', isTdap || isCriminal || isHepB || isVaricella || isMmr || isInfluenza || isTuberculin || isBls || isCovid);
        criminalDisclosureWrap?.classList.toggle('d-none', !isCriminal);
        criminalDisclosureDownloadWrap?.classList.toggle('d-none', !isCriminal);
        hepBSubmissionWrap?.classList.toggle('d-none', !isHepB);
        varicellaSubmissionWrap?.classList.toggle('d-none', !isVaricella);
        mmrSubmissionWrap?.classList.toggle('d-none', !isMmr);
        influenzaSubmissionWrap?.classList.toggle('d-none', !isInfluenza);
        tuberculinSubmissionWrap?.classList.toggle('d-none', !isTuberculin);
        covidSubmissionWrap?.classList.toggle('d-none', !isCovid);
        if (isTdap){
          subCompletedFields?.classList.remove('d-none');
          subSeriesFields?.classList.remove('d-none');
          subOtherFields?.classList.add('d-none');
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isCriminal){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetDisclosureFields();
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isHepB){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          resetHepBFields();
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isVaricella){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          resetVaricellaFields();
          updateVaricellaOption();
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isMmr){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          resetMmrFields();
          updateMmrOption();
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isInfluenza){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          resetInfluenzaFields();
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isTuberculin){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          resetTuberculinFields();
          updateTuberculinOption();
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isBls){
          subCompletedFields?.classList.remove('d-none');
          subSeriesFields?.classList.add('d-none');
          subOtherFields?.classList.add('d-none');
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
        }else if (isCovid){
          [subCompletedFields, subSeriesFields, subOtherFields].forEach(el => el?.classList.add('d-none'));
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          resetCovidFields();
          updateCovidOption();
        }else{
          criminalDisclosureWrap?.classList.add('d-none');
          criminalDisclosureDownloadWrap?.classList.add('d-none');
          hepBSubmissionWrap?.classList.add('d-none');
          varicellaSubmissionWrap?.classList.add('d-none');
          mmrSubmissionWrap?.classList.add('d-none');
          influenzaSubmissionWrap?.classList.add('d-none');
          tuberculinSubmissionWrap?.classList.add('d-none');
          covidSubmissionWrap?.classList.add('d-none');
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
        if (currentGroup === 'cpnw'){
          reqSort = { key: 'label', dir: 'asc' };
        }
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
        varicellaRadios.forEach(r => { r.checked = false; });
        mmrRadios.forEach(r => { r.checked = false; });
        [subCompletedDate, subSeriesStart, subSeriesDue, subOtherNotes, varicellaDose1Date, varicellaDose2Date, varicellaTiterDate, mmrDose1Date, mmrDose2Date, influenzaDate0, influenzaLocation0].forEach(el => {
          if (el) el.value = '';
        });
        [varicellaTiterPositive, varicellaTiterNegative].forEach(el => { if (el) el.checked = false; });
        [subCompletedFields, subSeriesFields, subOtherFields, varicellaVaccinationFields, varicellaTiterFields].forEach(el => el?.classList.add('d-none'));
        resetInfluenzaFields();
        resetTuberculinFields();
        resetCovidFields();
        resetMmrFields();
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
        const storedMessages = studentData.messages?.[id];
        currentMessages = storedMessages
          ? storedMessages
          : (messageThreads[id] ? messageThreads[id] : defaultThreadFor(req));
        messageThreads[id] = currentMessages;
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

        renderReqHead();
        if (listLabel) listLabel.textContent = groupTitle(currentGroup);
        if (listSub) listSub.textContent = 'Select a requirement to view details and submit.';

        if (currentGroup === 'cpnw'){
          const compareStrings = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity:'base' });
          filtered.sort((a, b) => {
            const key = reqSort.key;
            if (key === 'expiration'){
              const at = a.expiration instanceof Date ? a.expiration.getTime() : null;
              const bt = b.expiration instanceof Date ? b.expiration.getTime() : null;
              if (at === null && bt === null) return 0;
              if (at === null) return 1;
              if (bt === null) return -1;
              return reqSort.dir === 'asc' ? at - bt : bt - at;
            }
            const av = key === 'reviewer'
              ? reviewerNameFor(a)
              : (key === 'status'
                ? String(a.status || '')
                : (key === 'type'
                  ? String(a.type || '')
                  : (key === 'frequency'
                    ? String(a.frequency || '')
                    : String(a.label || ''))));
            const bv = key === 'reviewer'
              ? reviewerNameFor(b)
              : (key === 'status'
                ? String(b.status || '')
                : (key === 'type'
                  ? String(b.type || '')
                  : (key === 'frequency'
                    ? String(b.frequency || '')
                    : String(b.label || ''))));
            const cmp = compareStrings(av, bv);
            return reqSort.dir === 'asc' ? cmp : -cmp;
          });
        }else{
          // Expiring/expired first, then incomplete, then submitted/complete.
          const order = { expired:0, 'expiring soon':1, expiring:2, 'not submitted':3, incomplete:4, submitted:5, approved:6, complete:7 };
          filtered.sort((a,b) => {
            const oa = order[String(a.status || '').toLowerCase()] ?? 99;
            const ob = order[String(b.status || '').toLowerCase()] ?? 99;
            if (oa != ob) return oa - ob;
            return String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity:'base' });
          });
        }

        const total = filtered.length;
        reqPageSize = Number(pageSizeSelect?.value || reqPageSize || 10);
        const totalPages = Math.max(1, Math.ceil(total / reqPageSize));
        if (reqPage > totalPages) reqPage = totalPages;
        const start = (reqPage - 1) * reqPageSize;
        const end = Math.min(start + reqPageSize, total);
        const pageItems = filtered.slice(start, end);

        listBody.innerHTML = pageItems.map(r => {
          const exp = r.expiration ? fmtDate(r.expiration) : '—';
          const reviewer = reviewerNameFor(r);
          if (currentGroup === 'cpnw'){
            return `
              <tr>
                <td class="fw-semibold">
                  <button class="btn btn-link p-0 text-decoration-none" type="button" data-view-req="${r.id}">${r.label}</button>
                </td>
                <td>${statusBadge(r.status)}</td>
                <td class="text-nowrap">${exp}</td>
                <td>${r.type || '—'}</td>
                <td>${r.frequency || '—'}</td>
                <td>${reviewer}</td>
              </tr>
            `;
          }
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
        }).join('') || `<tr><td colspan="${currentGroup === 'cpnw' ? 6 : 6}" class="text-body-secondary small">No results.</td></tr>`;

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
        const submissionMode = isTdapRequirement(req)
          ? 'tdap'
          : (isCriminalDisclosureRequirement(req)
            ? 'criminal_disclosure'
            : (isHepBRequirement(req)
              ? 'hep_b'
              : (isVaricellaRequirement(req)
                ? 'varicella'
                : (isMmrRequirement(req)
                  ? 'mmr'
                  : (isInfluenzaRequirement(req)
                    ? 'influenza'
                    : (isTuberculinRequirement(req)
                      ? 'tuberculin'
                      : (isBlsRequirement(req)
                        ? 'bls'
                        : (isCovidRequirement(req)
                          ? 'covid'
                          : (Array.from(subRadios).find(r => r.checked)?.value || '')))))))));

        const influenzaEntries = isInfluenzaRequirement(req) && influenzaVaccinations
          ? Array.from(influenzaVaccinations.querySelectorAll('[data-influenza-entry], [data-influenza-extra]'))
            .map(row => {
              const date = row.querySelector('input[type="date"]')?.value || '';
              const location = (row.querySelector('input[type="text"]')?.value || '').trim();
              return (date || location) ? { date, location } : null;
            })
            .filter(Boolean)
          : [];

        const covidEntries = isCovidRequirement(req) && covidDoseList
          ? Array.from(covidDoseList.querySelectorAll('input[type="date"]'))
            .map(el => el.value)
            .filter(Boolean)
          : [];

        const collectMmrRows = (type) => {
          const group = mmrGroupFor(type);
          if (!group) return [];
          return Array.from(group.querySelectorAll('[data-mmr-row]'))
            .map(row => ({
              date: row.querySelector('input[type="date"]')?.value || '',
              result: row.querySelector('input[type="radio"]:checked')?.value || ''
            }))
            .filter(row => row.date || row.result);
        };

        const mmrTiterEntries = isMmrRequirement(req)
          ? {
            measles: collectMmrRows('measles'),
            mumps: collectMmrRows('mumps'),
            rubella: collectMmrRows('rubella')
          }
          : null;

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
          } : null,
          varicella: isVaricellaRequirement(req) ? {
            option: Array.from(varicellaRadios).find(r => r.checked)?.value || '',
            vaccinationDates: [varicellaDose1Date?.value || '', varicellaDose2Date?.value || ''].filter(Boolean),
            titerDate: varicellaTiterDate?.value || '',
            titerResult: varicellaTiterPositive?.checked ? 'positive' : (varicellaTiterNegative?.checked ? 'negative' : '')
          } : null,
          mmr: isMmrRequirement(req) ? {
            option: Array.from(mmrRadios).find(r => r.checked)?.value || '',
            vaccinationDates: [mmrDose1Date?.value || '', mmrDose2Date?.value || ''].filter(Boolean),
            titers: mmrTiterEntries
          } : null,
          influenza: isInfluenzaRequirement(req) ? {
            vaccinations: influenzaEntries
          } : null,
          tuberculin: isTuberculinRequirement(req) ? {
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
          covid: isCovidRequirement(req) ? {
            noVaccination: !!covidNoVaccination?.checked,
            manufacturer: (covidManufacturer?.value || '').trim(),
            doses: covidEntries
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

        if (requirementsStore && currentUser?.email){
          requirementsStore.setSubmission(
            { email: currentUser.email, sid: currentUser.sid || '' },
            req.label,
            { source: 'student', updatedAt: new Date().toISOString() }
          );
        }
        requirements = rebuildRequirements();
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
        const sortBtn = e.target.closest('[data-req-sort]');
        if (sortBtn && currentGroup === 'cpnw'){
          const key = sortBtn.dataset.reqSort || '';
          if (key){
            if (reqSort.key === key){
              reqSort = { ...reqSort, dir: reqSort.dir === 'asc' ? 'desc' : 'asc' };
            }else{
              reqSort = { key, dir: 'asc' };
            }
            renderReqList();
          }
          return;
        }
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
        group?.querySelectorAll('input[type="radio"]').forEach(input => {
          input.addEventListener('change', () => updateMmrBoosterVisibility(type));
        });
        group?.querySelector('[data-mmr-add]')?.addEventListener('click', () => addMmrBoosterRow(type));
      });
      influenzaAdd?.addEventListener('click', addInfluenzaField);
      tuberculinOptionTwoStep?.addEventListener('change', updateTuberculinOption);
      tuberculinOptionIgra?.addEventListener('change', updateTuberculinOption);
      tuberculinOptionHistory?.addEventListener('change', updateTuberculinOption);
      tuberculinDownload?.addEventListener('click', downloadTuberculinForm);
      covidNoVaccination?.addEventListener('change', updateCovidOption);
      covidAddBooster?.addEventListener('click', addCovidBooster);

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
        if (currentReqId){
          messageThreads[currentReqId] = currentMessages;
          studentData.messages = studentData.messages || {};
          studentData.messages[currentReqId] = currentMessages;
          saveStudentData(studentData);
        }
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
  
