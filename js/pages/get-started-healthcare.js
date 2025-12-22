
    (function(){
      const form = document.getElementById('healthcareGetStartedForm');
      const packagesWrap = document.getElementById('healthcarePackages');
      const packageError = document.getElementById('packageError');

      const duesBody = document.getElementById('membershipDuesBody');
      const facilityList = document.getElementById('facilityList');
      const addFacilityBtn = document.getElementById('addFacilityBtn');
      const facilityTpl = document.getElementById('facilityTemplate');

      if (!form || !packagesWrap || !duesBody || !facilityList || !addFacilityBtn || !facilityTpl) return;

      const healthcarePackages = [
        {
          id: 'hp-1',
          name: 'Affiliate: Placement Coordination Package',
          description: [
            {
              text: 'Facility gridding support and coordination of student placements through primary point of contact through the CPNW Regional Clinical Coordinator',
              nestedItems: [
                'This role ensures seamless communication, accurate representation of program placement needs, and regular updates to address evolving requirements. The CPNW Coordinator liaises with both education and healthcare partners to ensure placements align with institutional goals and unit parameters set by the institution.'
              ]
            },
            { text: 'Facility grad access via the CPNW website.' },
            {
              text: 'CPNW support of Shortfall Replacement management throughout the academic year, addressing gaps in clinical placements by facilitating adjustments and reallocations in collaboration with healthcare and education partners.'
            },
            { text: 'This package does not include Student Onboarding Support.' }
          ]
        },
        {
          id: 'hp-2',
          name: 'Affiliate: Onboarding Package',
          description: [
            {
              text: 'Access to CPNW website for student Onboarding support and management.',
              nestedItems: [
                'Streamlined management of standardized health and safety standards (vaccination history, background checks, certifications, integrated OIG/GSA checks, etc.)',
                'This package includes the healthcare partners’ ability to develop and deploy their own Site-Specific Requirements for student onboarding. For example, onboarding requirements can be customized to differ between Acute Care settings and Ambulatory or Clinic settings, ensuring alignment with facility-specific needs.'
              ]
            },
            { text: 'This package does not include clinical placement coordination or facility gridding.' }
          ]
        },
        {
          id: 'hp-3',
          name: 'Full Healthcare Package',
          description: [
            {
              text: 'Includes full membership services for website access and onboarding services:',
              nestedItems: [
                'Clinical Placement gridding and coordination support of student placements.',
                'Shortfall management and support.',
                'Full website access for Student Onboarding management.'
              ]
            }
          ]
        }
      ];

      const membershipDues = [{"studentPlacementCountMinimum":1,"studentPlacementCountMaximum":25,"fullMemberTotalDues":350.62,"option1or2AffiliateMemberTotalDues":292.97},{"studentPlacementCountMinimum":26,"studentPlacementCountMaximum":50,"fullMemberTotalDues":701.25,"option1or2AffiliateMemberTotalDues":525.94},{"studentPlacementCountMinimum":51,"studentPlacementCountMaximum":75,"fullMemberTotalDues":1051.88,"option1or2AffiliateMemberTotalDues":788.91},{"studentPlacementCountMinimum":76,"studentPlacementCountMaximum":100,"fullMemberTotalDues":1402.5,"option1or2AffiliateMemberTotalDues":1051.88},{"studentPlacementCountMinimum":101,"studentPlacementCountMaximum":125,"fullMemberTotalDues":1753.13,"option1or2AffiliateMemberTotalDues":1314.84},{"studentPlacementCountMinimum":126,"studentPlacementCountMaximum":150,"fullMemberTotalDues":2103.75,"option1or2AffiliateMemberTotalDues":1577.81},{"studentPlacementCountMinimum":151,"studentPlacementCountMaximum":175,"fullMemberTotalDues":2454.38,"option1or2AffiliateMemberTotalDues":1840.78},{"studentPlacementCountMinimum":176,"studentPlacementCountMaximum":200,"fullMemberTotalDues":2805,"option1or2AffiliateMemberTotalDues":2103.75},{"studentPlacementCountMinimum":201,"studentPlacementCountMaximum":225,"fullMemberTotalDues":3155.63,"option1or2AffiliateMemberTotalDues":2366.72},{"studentPlacementCountMinimum":226,"studentPlacementCountMaximum":250,"fullMemberTotalDues":3506.25,"option1or2AffiliateMemberTotalDues":2629.69},{"studentPlacementCountMinimum":251,"studentPlacementCountMaximum":275,"fullMemberTotalDues":3856.88,"option1or2AffiliateMemberTotalDues":2892.66},{"studentPlacementCountMinimum":276,"studentPlacementCountMaximum":300,"fullMemberTotalDues":4207.5,"option1or2AffiliateMemberTotalDues":3155.63},{"studentPlacementCountMinimum":301,"studentPlacementCountMaximum":325,"fullMemberTotalDues":4558.13,"option1or2AffiliateMemberTotalDues":3418.59},{"studentPlacementCountMinimum":326,"studentPlacementCountMaximum":350,"fullMemberTotalDues":4908.75,"option1or2AffiliateMemberTotalDues":3681.56},{"studentPlacementCountMinimum":351,"studentPlacementCountMaximum":375,"fullMemberTotalDues":5259.38,"option1or2AffiliateMemberTotalDues":3944.53},{"studentPlacementCountMinimum":376,"studentPlacementCountMaximum":400,"fullMemberTotalDues":5610,"option1or2AffiliateMemberTotalDues":4207.5},{"studentPlacementCountMinimum":401,"studentPlacementCountMaximum":425,"fullMemberTotalDues":5960.63,"option1or2AffiliateMemberTotalDues":4470.47},{"studentPlacementCountMinimum":426,"studentPlacementCountMaximum":450,"fullMemberTotalDues":6311.25,"option1or2AffiliateMemberTotalDues":4733.44},{"studentPlacementCountMinimum":451,"studentPlacementCountMaximum":475,"fullMemberTotalDues":6661.88,"option1or2AffiliateMemberTotalDues":4996.41},{"studentPlacementCountMinimum":476,"studentPlacementCountMaximum":500,"fullMemberTotalDues":7012.5,"option1or2AffiliateMemberTotalDues":5259.38}];

      function formatUSD(value){
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
      }

      function renderDues(){
        duesBody.innerHTML = membershipDues.map((row) => {
          const range = `${row.studentPlacementCountMinimum}–${row.studentPlacementCountMaximum}`;
          return `\n            <tr>\n              <td class="fw-semibold">${range}</td>\n              <td>${formatUSD(row.fullMemberTotalDues)}</td>\n              <td>${formatUSD(row.option1or2AffiliateMemberTotalDues)}</td>\n            </tr>\n          `;\n        }).join('');
      }

      function renderPackages(){
        packagesWrap.innerHTML = healthcarePackages.map((p, idx) => {\n          const id = `healthcarePackage_${idx+1}`;\n          const details = (p.description || []).map((li) => {\n            const nested = (li.nestedItems || []).length\n              ? `<ul class=\"mt-1 mb-0 ps-3\">${li.nestedItems.map(n => `<li>${n}</li>`).join('')}</ul>`\n              : '';\n            return `<li>${li.text}${nested}</li>`;\n          }).join('');\n\n          return `\n            <div class=\"col-12 col-lg-6\">\n              <div class=\"cpnw-shell p-3 h-100\" data-package-card tabindex=\"0\">\n                <div class=\"form-check\">\n                  <input class=\"form-check-input\" type=\"radio\" name=\"healthcarePackage\" id=\"${id}\" value=\"${p.id}\" ${idx === 0 ? '' : ''} />\n                  <label class=\"form-check-label fw-semibold\" for=\"${id}\">${p.name}</label>\n                </div>\n                <ul class=\"small text-body-secondary mb-0 ps-4 mt-2\">${details}</ul>\n              </div>\n            </div>\n          `;\n        }).join('');
      }

      function renderFacilityCard(){
        const fragment = facilityTpl.content.cloneNode(true);
        const shell = fragment.querySelector('.cpnw-shell');
        const removeBtn = fragment.querySelector('[data-remove-facility]');
        const selects = fragment.querySelectorAll('select[data-field=\"servicePackage\"]');
        const title = fragment.querySelector('.fw-semibold');

        const index = facilityList.children.length + 1;
        if (title) title.textContent = `Healthcare Facility ${index}`;

        selects.forEach((select) => {\n          select.innerHTML = `\n            <option value=\"\" selected>Select</option>\n            ${healthcarePackages.map(p => `<option value=\"${p.id}\">${p.name}</option>`).join('')}\n          `;\n        });\n\n        if (shell){\n          shell.querySelectorAll('[data-field]').forEach((input) => {\n            const field = input.getAttribute('data-field');\n            input.name = `facilities[${index}][${field}]`;\n            input.id = `facility-${index}-${field}`;\n            const label = shell.querySelector(`[data-label-for=\"${field}\"]`);\n            if (label) label.setAttribute('for', input.id);\n          });\n        }\n\n        removeBtn?.addEventListener('click', () => {\n          shell?.remove();\n          renumberFacilities();\n        });\n\n        facilityList.appendChild(fragment);\n      }

      function renumberFacilities(){
        Array.from(facilityList.children).forEach((shell, idx) => {\n          const index = idx + 1;\n          const title = shell.querySelector('.fw-semibold');\n          if (title) title.textContent = `Healthcare Facility ${index}`;\n          shell.querySelectorAll('[data-field]').forEach((input) => {\n            const field = input.getAttribute('data-field');\n            input.name = `facilities[${index}][${field}]`;\n            input.id = `facility-${index}-${field}`;\n            const label = shell.querySelector(`[data-label-for=\"${field}\"]`);\n            if (label) label.setAttribute('for', input.id);\n          });\n        });\n      }

      function setPackageError(message){
        if (!packageError) return;
        packageError.textContent = message || 'Please select a package.';
        packageError.classList.toggle('d-none', !message);
      }

      function getSelectedHealthcarePackage(){
        return document.querySelector('input[name=\"healthcarePackage\"]:checked')?.value || '';
      }

      renderPackages();
      renderDues();

      addFacilityBtn.addEventListener('click', renderFacilityCard);

      form.addEventListener('change', (e) => {
        if (e.target && e.target.name === 'healthcarePackage') setPackageError('');
      });

      form.addEventListener('reset', () => {
        setTimeout(() => {\n          facilityList.innerHTML = '';\n          setPackageError('');\n        }, 0);\n      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        form.classList.add('was-validated');
\n        if (!getSelectedHealthcarePackage()){\n          setPackageError('Please select a package.');\n          document.getElementById('healthcarePackage_1')?.focus();\n          return;\n        }\n\n        if (!form.checkValidity()){\n          const firstInvalid = form.querySelector(':invalid');\n          firstInvalid?.focus();\n          return;\n        }\n\n        alert('Thanks! Your Healthcare Partner form has been submitted (demo).');\n        form.reset();\n        form.classList.remove('was-validated');\n      });
    })();
  

