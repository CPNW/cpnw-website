
    (function(){
      const form = document.getElementById('academicGetStartedForm');
      const list = document.getElementById('programList');
      const tpl = document.getElementById('programTemplate');
      const addBtn = document.getElementById('addProgramBtn');
      const partnerMember = document.getElementById('partnerMember');
      const partnerCommunity = document.getElementById('partnerCommunity');
      const multiYearNote = document.getElementById('multiYearNote');
      const repWrap = document.getElementById('representativeWrap');
      const paymentMethod = document.getElementById('paymentMethod');
      const paymentMethodHelp = document.getElementById('paymentMethodHelp');

      if (!form || !list || !tpl || !addBtn) return;

      function addProgram(){
        const fragment = tpl.content.cloneNode(true);
        const shell = fragment.querySelector('.cpnw-shell');
        const removeBtn = fragment.querySelector('[data-remove-program]');

        if (shell){
          const index = list.children.length + 1;
          shell.dataset.programIndex = String(index);
          shell.querySelector('.fw-semibold')?.append(` ${index}`);
          shell.querySelectorAll('[data-field]').forEach((input) => {
            const field = input.getAttribute('data-field');
            input.name = `programs[${index}][${field}]`;
            input.id = `program-${index}-${field}`;
            const label = shell.querySelector(`[data-label-for="${field}"]`);
            if (label) label.setAttribute('for', input.id);
          });
        }

        removeBtn?.addEventListener('click', () => {
          shell?.remove();
          renumberPrograms();
        });

        list.appendChild(fragment);
      }

      function renumberPrograms(){
        Array.from(list.children).forEach((shell, idx) => {
          const index = idx + 1;
          shell.dataset.programIndex = String(index);
          const title = shell.querySelector('.fw-semibold');
          if (title) title.textContent = `Program ${index}`;
          shell.querySelectorAll('[data-field]').forEach((input) => {
            const field = input.getAttribute('data-field');
            input.name = `programs[${index}][${field}]`;
            input.id = `program-${index}-${field}`;
            const label = shell.querySelector(`[data-label-for="${field}"]`);
            if (label) label.setAttribute('for', input.id);
          });
        });
      }

      function setMultiYearDisabled(disabled){
        document.querySelectorAll('input[name="multiYearPackage"]').forEach((el) => {
          if (el.id === 'multi0') return;
          el.disabled = disabled;
        });
        if (multiYearNote){
          multiYearNote.textContent = disabled ? '*Only available to CPNW Members.' : '';
        }
        if (disabled){
          const none = document.getElementById('multi0');
          if (none) none.checked = true;
          repWrap?.classList.add('d-none');
        }
      }

      function updateRepresentativeVisibility(){
        const selected = document.querySelector('input[name="multiYearPackage"]:checked')?.value || '';
        const isMember = !!partnerMember?.checked;
        const show = isMember && selected && selected !== '';
        if (repWrap) repWrap.classList.toggle('d-none', !show);
        document.getElementById('repName')?.toggleAttribute('required', show);
        document.getElementById('repEmail')?.toggleAttribute('required', show);
      }

      function updatePaymentMethod(){
        const hasCheckr = (document.querySelector('input[name="checkrAddon"]:checked')?.value || '') !== '';
        if (!paymentMethod) return;

        const selfPayOption = Array.from(paymentMethod.options).find(o => o.value === 'selfpay');
        if (selfPayOption) selfPayOption.disabled = hasCheckr;

        if (hasCheckr && paymentMethod.value === 'selfpay'){
          paymentMethod.value = 'institution';
        }
        if (paymentMethodHelp){
          paymentMethodHelp.textContent = hasCheckr
            ? 'Student / Self Pay is disabled when a Checkr background check service is selected (demo behavior).'
            : '';
        }
      }

      // Start with one program card.
      addProgram();

      const disciplineSelect = document.getElementById('programDiscipline');
      const disciplineDescription = document.getElementById('programDisciplineDescription');
      const packageSelectionError = document.getElementById('packageSelectionError');
      const invoiceFrequencyNote = document.getElementById('invoiceFrequencyNote');

      const disciplines = [
        {
          value: 'prelic-clinical',
          label: 'Pre-licensure Nursing (Clinical)',
          description:
            'This category includes students who will have direct interactions with facility patients or PHI, necessitating access to Electronic Health Records (EHR), other facility systems, and security badge clearance.',
          examples: [
            'Licensed Practical Nurse (LPN)',
            'Registered Nurse (RN)',
            'Bachelor of Science in Nursing (BSN)',
            'Refresher Registered Nurses (RN)',
            'Associate Degree in Nursing to Registered Nurse (ADN-RN)',
            'Associate Degree in Nursing to Bachelor of Science in Nursing (ADN-BSN)'
          ]
        },
        {
          value: 'postlic-clinical',
          label: 'Post-licensure Nursing (Clinical)',
          description:
            'This category includes students who will have direct interactions with facility patients or PHI, necessitating access to Electronic Health Records (EHR), other facility systems, and security badge clearance.',
          examples: [
            'Advanced Registered Nurse Practitioner (ARNP)',
            'Doctor of Nursing Practice (DNP)',
            'Master of Nursing / Master of Science in Nursing (MN/MSN)',
            'Midwifery',
            'Nurse Anesthesia (SRNA)',
            'Registered Nurse First Assistant (RNFA)'
          ]
        },
        {
          value: 'postlic-nonclinical',
          label: 'Post-licensure Nursing (Non-Clinical)',
          description:
            'This category includes students who will not be in direct contact with facility patients or accessing PHI, and/or do not require access to Electronic Health Records (EHR) or other facility systems. It also applies to students involved in student projects or presentations that do not involve direct patient care.',
          examples: [
            'Advanced Registered Nurse Practitioner (ARNP)',
            'Doctor of Nursing Practice (DNP)',
            'Master of Nursing / Master of Science in Nursing (MN/MSN)'
          ]
        },
        {
          value: 'allied-clinical',
          label: 'Allied Health and Professions (Clinical)',
          description:
            'This category includes students who will have direct interactions with facility patients or PHI, necessitating access to Electronic Health Records (EHR), other facility systems, and security badge clearance.',
          examples: [
            'Dietetics',
            'Radiologic Technology',
            'Surgical Technology',
            'Psychology (PsyD)',
            'Master of Social Work (MSW)',
            'Occupational Therapy (OT)',
            'Physical Therapy (PT)',
            'Pharmacy',
            'Respiratory Therapy',
            'Medical Coding',
            'Health Informatics',
            'Global/Public Health',
            'Health Information Management (HIM)',
            'Administration'
          ]
        },
        {
          value: 'allied-nonclinical',
          label: 'Allied Health and Professions (Non-Clinical)',
          description:
            'This category includes students who will not be in direct contact with facility patients or accessing PHI, and/or do not require access to Electronic Health Records (EHR) or other facility systems. It also applies to students involved in student projects or presentations that do not involve direct patient care.',
          examples: [
            'Psychology (PsyD)',
            'Administrative roles',
            'Medical Coding',
            'Global/Public Health',
            'Health Information Management (HIM)',
            'Administration'
          ]
        }
      ];

      function getSelectedDiscipline(){
        return disciplineSelect?.value || '';
      }

      function isAlliedDiscipline(value){
        return value === 'allied-clinical' || value === 'allied-nonclinical';
      }

      function setInvoiceFrequencyTooltipsEnabled(enabled){
        const cards = document.querySelectorAll('[data-invoice-frequency-card]');
        cards.forEach((card) => {
          const existing = bootstrap.Tooltip.getInstance(card);
          if (!enabled){
            existing?.dispose();
            card.removeAttribute('data-bs-toggle');
            card.removeAttribute('data-bs-placement');
            card.removeAttribute('data-bs-title');
            card.removeAttribute('title');
            return;
          }
          card.setAttribute('data-bs-toggle', 'tooltip');
          card.setAttribute('data-bs-placement', 'top');
          card.setAttribute('data-bs-title', 'Select a program discipline first.');
          if (!existing){
            new bootstrap.Tooltip(card, { trigger: 'hover focus' });
          }
        });
      }

      function updateInvoiceFrequencyRules(){
        const discipline = getSelectedDiscipline();
        const hasDiscipline = !!discipline;
        const onlyQuarterly = isAlliedDiscipline(discipline);

        const invAnnually = document.getElementById('invFreqAnnually');
        const invTwice = document.getElementById('invFreqTwice');
        const invThree = document.getElementById('invFreqThree');
        const invQuarterly = document.getElementById('invFreqQuarterly');

        const all = [invAnnually, invTwice, invThree, invQuarterly].filter(Boolean);
        all.forEach((el) => {
          el.disabled = !hasDiscipline;
        });

        if (!hasDiscipline){
          all.forEach((el) => {
            el.checked = false;
          });
          if (invoiceFrequencyNote) invoiceFrequencyNote.textContent = 'Select a program discipline to choose an invoicing option.';
          setInvoiceFrequencyTooltipsEnabled(true);
          return;
        }

        setInvoiceFrequencyTooltipsEnabled(false);

        if (onlyQuarterly){
          if (invAnnually) invAnnually.disabled = true;
          if (invTwice) invTwice.disabled = true;
          if (invThree) invThree.disabled = true;
          if (invQuarterly){
            invQuarterly.disabled = false;
            invQuarterly.checked = true;
          }
          if (invoiceFrequencyNote) invoiceFrequencyNote.textContent = 'Allied Health disciplines require quarterly invoicing.';
          return;
        }

        // Default selection once discipline is chosen (matches dev behavior).
        if (!document.querySelector('input[name="invoiceFrequency"]:checked')){
          if (invAnnually) invAnnually.checked = true;
        }
        if (invoiceFrequencyNote) invoiceFrequencyNote.textContent = '';
      }

      disciplineSelect?.addEventListener('change', () => {
        const value = disciplineSelect.value || '';
        const discipline = disciplines.find((d) => d.value === value) || null;
        if (!disciplineDescription) return;
        if (!discipline){
          disciplineDescription.textContent = '';
          disciplineDescription.classList.add('d-none');
          updateInvoiceFrequencyRules();
          return;
        }

        const title = document.createElement('div');
        title.className = 'fw-semibold';
        title.textContent = discipline.label;

        const desc = document.createElement('p');
        desc.className = 'small text-body-secondary mb-2';
        desc.textContent = discipline.description;

        const list = document.createElement('ul');
        list.className = 'small text-body-secondary mb-0 ps-3';
        (discipline.examples || []).forEach((example) => {
          const li = document.createElement('li');
          li.textContent = example;
          list.appendChild(li);
        });

        disciplineDescription.textContent = '';
        disciplineDescription.appendChild(title);
        disciplineDescription.appendChild(desc);
        if ((discipline.examples || []).length) disciplineDescription.appendChild(list);
        disciplineDescription.classList.remove('d-none');
        updateInvoiceFrequencyRules();
      });

      function getSelectedAnnualPackage(){
        return document.querySelector('input[name="annualPackage"]:checked')?.value || '';
      }

      function getSelectedMultiYearPackage(){
        return document.querySelector('input[name="multiYearPackage"]:checked')?.value || '';
      }

      function setPackageInputsDisabled(disabled){
        document.querySelectorAll('input[name="annualPackage"], input[name="multiYearPackage"]').forEach((el) => {
          el.disabled = !!disabled;
        });
      }

      function setPackageTooltipsEnabled(enabled){
        const cards = document.querySelectorAll('[data-package-card]');
        cards.forEach((card) => {
          const existing = bootstrap.Tooltip.getInstance(card);
          if (!enabled){
            existing?.dispose();
            card.removeAttribute('data-bs-toggle');
            card.removeAttribute('data-bs-placement');
            card.removeAttribute('data-bs-title');
            card.removeAttribute('title');
            return;
          }

          card.setAttribute('data-bs-toggle', 'tooltip');
          card.setAttribute('data-bs-placement', 'top');
          card.setAttribute('data-bs-title', 'Select CPNW Member or Community Partner first.');
          if (!existing){
            new bootstrap.Tooltip(card, { trigger: 'hover focus' });
          }
        });
      }

      function setPackageError(message){
        if (!packageSelectionError) return;
        packageSelectionError.textContent = message || '';
        packageSelectionError.classList.toggle('d-none', !message);
      }

      function clearAnnualPackageSelection(){
        document.querySelectorAll('input[name="annualPackage"]').forEach((el) => {
          el.checked = false;
        });
      }

      function selectMultiYearNone(){
        const none = document.getElementById('multi0');
        if (none) none.checked = true;
      }

      function syncPackageRules(origin){
        const isMember = !!partnerMember?.checked;
        const isCommunity = !!partnerCommunity?.checked;

        if (!isMember && !isCommunity){
          setPackageInputsDisabled(true);
          setPackageTooltipsEnabled(true);
          setPackageError('');
          return;
        }

        setPackageInputsDisabled(false);
        setPackageTooltipsEnabled(false);

        if (isCommunity){
          setMultiYearDisabled(true);
          setPackageError('');
          return;
        }

        if (isMember){
          setMultiYearDisabled(false);
          const annual = getSelectedAnnualPackage();
          const multi = getSelectedMultiYearPackage();

          if (origin === 'annual' && annual){
            selectMultiYearNone();
          }
          if (origin === 'multi' && multi){
            if (multi !== '') clearAnnualPackageSelection();
          }
          setPackageError('');
        }
      }

      // Enforce: community partners cannot pick multi-year; members pick annual OR multi-year (not both).
      document.querySelectorAll('input[name="annualPackage"]').forEach((el) => {
        el.addEventListener('change', () => {
          syncPackageRules('annual');
          updateRepresentativeVisibility();
        });
      });
      document.querySelectorAll('input[name="multiYearPackage"]').forEach((el) => {
        el.addEventListener('change', () => {
          syncPackageRules('multi');
          updateRepresentativeVisibility();
        });
      });

      addBtn.addEventListener('click', addProgram);
      partnerCommunity?.addEventListener('change', () => syncPackageRules('partner'));
      partnerMember?.addEventListener('change', () => syncPackageRules('partner'));
      document.querySelectorAll('input[name="checkrAddon"]').forEach((el) => {
        el.addEventListener('change', updatePaymentMethod);
      });
      paymentMethod?.addEventListener('change', updatePaymentMethod);

      // Default state.
      setMultiYearDisabled(false);
      syncPackageRules('init');
      updateRepresentativeVisibility();
      updatePaymentMethod();
      updateInvoiceFrequencyRules();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        form.classList.add('was-validated');

        const isMember = !!partnerMember?.checked;
        const isCommunity = !!partnerCommunity?.checked;
        const annual = getSelectedAnnualPackage();
        const multi = getSelectedMultiYearPackage();

        if (isCommunity && !annual){
          setPackageError('Please select a service package.');
          document.getElementById('annualPkg1')?.focus();
          return;
        }
        if (isMember && !annual && !multi){
          setPackageError('Please select either a service package or a multi-year package.');
          document.getElementById('annualPkg1')?.focus();
          return;
        }

        if (!form.checkValidity()){
          const firstInvalid = form.querySelector(':invalid');
          firstInvalid?.focus();
          return;
        }

        alert('Thanks! Your Academic Partner form has been submitted (demo).');
        form.reset();
        form.classList.remove('was-validated');
        setPackageError('');
        disciplineDescription?.classList.add('d-none');
        if (disciplineDescription) disciplineDescription.textContent = '';
        updateInvoiceFrequencyRules();

        // Restore initial UI defaults after reset.
        list.innerHTML = '';
        addProgram();
        setMultiYearDisabled(false);
        syncPackageRules('reset');
        updateRepresentativeVisibility();
        updatePaymentMethod();
      });
    })();
  

