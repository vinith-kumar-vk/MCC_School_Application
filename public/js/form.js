// form.js - MCC School Dynamic Multi-Step Logic
let currentStep = 1;
const totalSteps = 4;
let dynamicFieldsConfig = [];
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('formId') || 2; // Default to XI/XII if none

document.addEventListener('DOMContentLoaded', async () => {
  await loadFormInfo();
  await loadDynamicFields();
  initFormLogic();
});

async function loadFormInfo() {
  try {
    const res = await fetch('/api/settings?t=' + Date.now());
    const s = await res.json();
    
    const formsRes = await fetch('/api/forms');
    const forms = await formsRes.json();
    const currentForm = forms.find(f => f.id == formId);

    const stitle = id('siteTitle'); if (stitle && s.site_title) stitle.textContent = s.site_title;
    const ssub = id('siteSubtitle'); if (ssub && s.site_subtitle) ssub.textContent = s.site_subtitle;
    
    // Update Sidebar/Header Logos
    if (s.logo_path) {
        document.querySelectorAll('.brand-logo, .footer-logo img').forEach(img => {
            img.src = s.logo_path + '?t=' + Date.now();
        });
    }

    // Update School Info in sidebar if exists
    const brandName = document.querySelector('.sidebar-brand-name');
    if (brandName && s.site_title) brandName.textContent = s.site_title;
    const brandTag = document.querySelector('.sidebar-tagline');
    if (brandTag && s.site_subtitle) brandTag.textContent = s.site_subtitle;
    
    const ftitle = id('formTitle'); 
    if (ftitle) {
      const perFormTitle = formId == 1 ? s.form1_title : s.form2_title;
      ftitle.textContent = perFormTitle || s.form_title || (currentForm ? currentForm.name : 'APPLICATION FOR ADMISSION');
    }
    
    const fsub = id('formSubtitle'); 
    if (fsub) fsub.textContent = currentForm ? currentForm.description : s.form_subtitle;
    
    const footer = id('footerText'); if (footer && s.footer_text) footer.textContent = s.footer_text;
    const logo = id('siteLogo'); if (logo && s.logo_path) logo.src = s.logo_path;
  } catch (e) { console.error('CMS Settings load error', e); }
}

async function loadDynamicFields() {
  try {
    const res = await fetch(`/api/form-fields?formId=${formId}&t=` + Date.now());
    dynamicFieldsConfig = await res.json();
    dynamicFieldsConfig.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));

    const stepsGroup = { 1: [], 2: [], 3: [], 4: [] };
    dynamicFieldsConfig.forEach(f => {
      if (stepsGroup[f.step]) stepsGroup[f.step].push(f);
    });

    // Step 1: render pupil_name separately into the name container (left side)
    const nameContainer = id('step1NameContainer');
    const step1Fields = stepsGroup[1];
    const nameField = step1Fields.find(f => f.field_name === 'pupil_name');
    const restOfStep1 = step1Fields.filter(f => f.field_name !== 'pupil_name');

    if (nameContainer && nameField) {
      const nf = { ...nameField, column_width: 12 };
      nameContainer.innerHTML = `<div class="row">${renderField(nf)}</div>`;
    }

    const step1Container = id('dynamicFieldsStep1');
    if (step1Container) step1Container.innerHTML = restOfStep1.map(f => renderField(f)).join('');

    // Steps 2-4: render normally
    for (let s = 2; s <= 4; s++) {
      const container = id(`dynamicFieldsStep${s}`);
      if (!container) continue;
      container.innerHTML = stepsGroup[s].map(f => renderField(f)).join('');
    }

    // Hide steps if they have no fields
    for (let s = 1; s <= 4; s++) {
      if (stepsGroup[s].length === 0) {
        const navItem = document.querySelector(`.nav-item[data-step="${s}"]`);
        if (navItem) navItem.style.display = 'none';
      }
    }

  } catch (e) { console.error('Dynamic fields load error', e); }
}


window.previewUserPhoto = previewUserPhoto;
function previewUserPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const errEl = id('err_photograph');
  if (errEl) errEl.textContent = '';
  
  const reader = new FileReader();
  reader.onload = (e) => {
    id('photoPreview').src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderField(f) {
  const reqAttr = f.required ? 'required' : '';
  const star = f.required ? '<span class="required-star">*</span>' : '';
  let inputHtml = '';
  const fname = f.field_name.toLowerCase();

  let extraAttrs = reqAttr;
  
  // Real-time digit locks to completely prevent text input
  if (/mobile|phone|whatsapp/.test(fname)) {
      extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);" pattern="\\d{10}" inputmode="numeric"`;
  } else if (/aadhar/.test(fname)) {
      extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 12);" pattern="\\d{12}" inputmode="numeric"`;
  } else if (/pin_?code/.test(fname)) {
      extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);" pattern="\\d{6}" inputmode="numeric"`;
  } else if (f.field_type === 'number' || /income|mark|year/.test(fname)) {
      extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9.]/g, '');" inputmode="decimal"`;
  }

  if (['text', 'email', 'tel', 'number', 'date', 'url'].includes(f.field_type)) {
    let finalType = f.field_type;
    // Override strict digit fields to 'tel' to ensure regex block works evenly across mobile browsers
    if ((/mobile|phone|whatsapp|aadhar|pin/.test(fname)) && finalType === 'number') finalType = 'tel'; 
    inputHtml = `<input type="${finalType}" class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" placeholder="${f.placeholder || ''}" ${extraAttrs} />`;
  } else if (f.field_type === 'textarea') {
    inputHtml = `<textarea class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" rows="2" placeholder="${f.placeholder || ''}" ${extraAttrs}></textarea>`;
  } else if (f.field_type === 'select') {
    const opts = (f.options || '').split(',').map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('');
    inputHtml = `<select class="form-control premium-input form-select" name="${f.field_name}" id="${f.field_name}" ${extraAttrs}>
      <option value="" disabled selected>${f.placeholder || 'Select...'}</option>
      ${opts}
    </select>`;
  }

  const colWidth = f.column_width || (f.field_type === 'textarea' ? 12 : 6);
  const colClass = `col-md-${colWidth}`;
  
  return `
    <div class="${colClass} mb-3">
      <div class="premium-field">
        <label for="${f.field_name}">${f.label} ${star}</label>
        ${inputHtml}
        <div class="error-msg" style="color:#ef4444; font-size:12.5px; margin-top:4px; font-weight:600;" id="err_${f.field_name}"></div>
      </div>
    </div>`;
}

// Ensure globally accessible helpers
window.id = id;
function id(name) { return document.getElementById(name); }

function initFormLogic() {
  const form = id('admissionForm');
  const steps = document.querySelectorAll('.form-step');
  const navItems = document.querySelectorAll('.nav-item');
  const nextBtn = id('nextBtn');
  const prevBtn = id('prevBtn');
  const submitBtn = id('submitBtn');
  const progressBar = id('progressBar');
  const currentStepText = id('currentStepText');

  function updateStep() {
    steps.forEach((step, idx) => {
      step.classList.toggle('active', idx + 1 === currentStep);
      step.classList.toggle('d-none', idx + 1 !== currentStep);
    });
    navItems.forEach((item, idx) => {
      item.classList.toggle('active', idx + 1 === currentStep);
      item.classList.toggle('completed', idx + 1 < currentStep);
    });
    prevBtn.classList.toggle('d-none', currentStep === 1);
    if (currentStep === totalSteps) {
      nextBtn.classList.add('d-none');
      submitBtn.classList.remove('d-none');
    } else {
      nextBtn.classList.remove('d-none');
      submitBtn.classList.add('d-none');
    }
    progressBar.style.width = `${(currentStep / totalSteps) * 100}%`;
    currentStepText.textContent = currentStep;
    document.querySelector('.form-container-scroll').scrollTop = 0;
  }

  nextBtn.addEventListener('click', () => { if (validateStep(currentStep)) { currentStep++; updateStep(); } });
  prevBtn.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateStep(); } });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    try {
      const formData = new FormData(form);
      formData.append('form_id', formId); // Include the selected form ID
      const res = await fetch('/api/apply', { 
        method: 'POST', 
        body: formData
      });
      const data = await res.json();
      if (data.success) { id('successModal').classList.add('active'); form.reset(); }
      else alert(data.message);
    } catch (err) { alert('Network error'); }
    finally { submitBtn.disabled = false; submitBtn.textContent = 'Finish & Submit'; }
  });

  function validateStep(sNum) {
    clearAllErrors();
    let isValid = true;
    
    // Validate photograph only on Step 1
    if (sNum === 1) {
      if (!id('photograph').files[0]) {
        isValid = false; showError('err_photograph', 'Photograph is required');
      }
    }

    const stepFields = dynamicFieldsConfig.filter(f => f.step === sNum);
    stepFields.forEach(f => {
      const el = id(f.field_name);
      if (!el) return;
      const fname = f.field_name.toLowerCase();
      const val = el.value.trim();
      
      if (f.required && !val) {
        isValid = false; showError(`err_${f.field_name}`, 'Required field'); el.classList.add('error'); return;
      }
      
      if (val) {
        if (f.field_type === 'email' && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(val)) {
            isValid = false; showError(`err_${f.field_name}`, 'Invalid email format'); el.classList.add('error');
        }
        if (/mobile|phone|whatsapp/.test(fname) && val.length !== 10) {
            isValid = false; showError(`err_${f.field_name}`, 'Must be exactly 10 digits'); el.classList.add('error');
        }
        if (/aadhar/.test(fname) && val.length !== 12) {
            isValid = false; showError(`err_${f.field_name}`, 'Must be exactly 12 digits'); el.classList.add('error');
        }
        if (/pin_?code/.test(fname) && val.length !== 6) {
            isValid = false; showError(`err_${f.field_name}`, 'Must be exactly 6 digits'); el.classList.add('error');
        }
      }
    });

    if (sNum === 4) {
      if (!id('decl1').checked) { isValid = false; showError('err_declaration', 'Declaration required'); }
    }
    return isValid;
  }

  function showError(tid, msg) { const el = id(tid); if (el) el.textContent = msg; }
  function clearAllErrors() {
    document.querySelectorAll('.error-msg').forEach(e => e.textContent = '');
    document.querySelectorAll('.premium-input').forEach(e => e.classList.remove('error'));
  }
  updateStep();
}

function closeModal() { id('successModal').classList.remove('active'); window.location.reload(); }
