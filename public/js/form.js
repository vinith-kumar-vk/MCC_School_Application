// form.js - MCC School Dynamic Multi-Step Logic
let currentStep = 1;
const totalSteps = 4;
let dynamicFieldsConfig = [];
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('formId') || 2; // Default to XI/XII if none

document.addEventListener('DOMContentLoaded', async () => {
  await loadFormInfo();
  await loadDynamicFields();
  initTamilTransliteration(); // Must be after fields are rendered
  await fetchSerialNo();
  initFormLogic();
});

async function fetchSerialNo() {
  try {
    const res = await fetch('/api/next-serial?t=' + Date.now());
    const data = await res.json();
    if (data.success) {
      // Only update the sticky header serial display
      const hEl = id('headerSerialDisplay');
      if (hEl) hEl.textContent = data.serialNo;
    }
  } catch (e) {
    console.error('Serial No fetch error', e);
  }
}

async function loadFormInfo() {
  try {
    const res = await fetch('/api/settings?t=' + Date.now());
    const s = await res.json();

    const formsRes = await fetch('/api/forms?t=' + Date.now());
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

    const fMobileClass = id('mobileClassTitle');
    const fsubtitle = id('formSubtitle');

    let displayClassName = (formId == 1) ? 'Pre-kg to UKG ADMISSION FORM' : 'Class XI Admission Form';
    if (currentForm && currentForm.name && currentForm.name !== 'APPLICATION FOR ADMISSION') {
       displayClassName = currentForm.name;
    }

    if (fMobileClass) fMobileClass.textContent = displayClassName;
    
    if (fsubtitle && currentForm) {
      fsubtitle.textContent = currentForm.subtitle || '';
    }

    const yearLabel = id('dynamicYearLabel');
    if (yearLabel && s.admission_year) yearLabel.textContent = s.admission_year;


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

    // Step 1: Render everything dynamically
    // Step 1: Render everything dynamically as per dashboard order
    const step1Fields = stepsGroup[1];
    const step1Container = id('dynamicFieldsStep1');
    if (step1Container) {
      step1Container.innerHTML = step1Fields.map(f => renderField(f)).join('');
    }

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
  } catch (e) {
    console.error('Dynamic fields load error', e);
  }
}

window.updateIncomeVal = (name) => {
  const c = id(`curr_${name}`).value;
  const v = id(`val_${name}`).value;
  id(name).value = v ? `${c} ${v}` : '';
};
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
  // Note: field names use 'aadhaar' (double-a), so regex must match both spellings
  if (/mobile|phone|whatsapp/.test(fname)) {
    extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);" pattern="\\d{10}" inputmode="numeric"`;
  } else if (/aadhaar|aadhar/.test(fname)) {
    extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 12);" pattern="\\d{12}" inputmode="numeric" maxlength="12"`;
  } else if (/pin_?code/.test(fname)) {
    extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);" pattern="\\d{6}" inputmode="numeric"`;
  } else if ((f.field_type === 'number' || /income|mark|year/.test(fname)) && !/id_mark|identifi|personal/.test(fname)) {
    extraAttrs += ` oninput="this.value = this.value.replace(/[^0-9.]/g, '');" inputmode="decimal"`;
  }

  if (['text', 'email', 'tel', 'number', 'date', 'url'].includes(f.field_type)) {
    let finalType = f.field_type;
    if ((/mobile|phone|whatsapp|aadhaar|aadhar|pin/.test(fname)) && finalType === 'number') finalType = 'tel';
    if (/id_mark|identifi|personal/.test(fname)) finalType = 'text';

    if (fname.includes('income')) {
      // Special case for Income fields: INR/Dollar dropdown + Number input
      inputHtml = `
          <div class="input-group">
            <select class="form-select border-maroon-thin" style="max-width: 85px; font-weight: 600; background-color: #fcfcfc;" id="curr_${f.field_name}" onchange="updateIncomeVal('${f.field_name}')">
              <option value="INR">INR</option>
              <option value="USD">USD ($)</option>
            </select>
            <input type="tel" class="form-control premium-input" id="val_${f.field_name}" placeholder="Amount" oninput="this.value = this.value.replace(/[^0-9]/g, ''); updateIncomeVal('${f.field_name}')" ${reqAttr} />
            <input type="hidden" name="${f.field_name}" id="${f.field_name}" ${reqAttr} />
          </div>
        `;
    } else {
      inputHtml = `<input type="${finalType}" class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" placeholder="${f.placeholder || ''}" ${extraAttrs} />`;
    }
  } else if (f.field_type === 'textarea') {
    inputHtml = `<textarea class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" rows="2" placeholder="${f.placeholder || ''}" ${extraAttrs}></textarea>`;
  } else if (f.field_type === 'select') {
    let opts = (f.options || '').split(',').map(p => p.trim()).filter(p => p).map(o => `<option value="${o}">${o}</option>`).join('');
    // Permanent fallback for T.C question
    if (f.label.toUpperCase().includes('T.C')) {
      opts = `<option value="Yes">Yes</option><option value="No">No</option>`;
    }
    inputHtml = `<select class="form-select" name="${f.field_name}" id="${f.field_name}" ${extraAttrs} style="height: 52px; border: 1.5px solid #ddd; background-color: #fff; cursor: pointer; position: relative; z-index: 10;">
      <option value="" disabled selected>${f.placeholder || 'Select...'}</option>
      ${opts}
    </select>`;
  } else if (f.field_type === 'photograph') {
    return `
      <div class="col-md-${f.column_width || 4} mb-3">
        <div class="text-center text-md-end">
           <span class="d-block mb-2 fw-bold text-muted " style="font-size: 0.75rem;">Affix Recent Passport Size Photograph ${star}</span>
           <div class="photo-box-centered mx-auto mx-md-0 position-relative " 
                style="float:right; width: 105px; height: 130px; border: 2px dashed #8b1a2e; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; cursor: pointer;"
                onclick="document.getElementById('photograph').click()">
              <img id="photoPreview" 
                   src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='105' height='130' viewBox='0 0 105 130'%3E%3Crect width='100%25' height='100%25' fill='%23fafafa'/%3E%3C/svg%3E" 
                   alt="Upload" style="width: 100%; height: 100%; object-fit: cover;" />
              <div class="upload-placeholder" style="position: absolute; text-align: center;">
                <i class="fa-solid fa-camera" style="color:#ccc; font-size:20px;"></i>
              </div>
           </div>
           <input type="file" name="photograph" id="photograph" class="d-none" accept="image/*" onchange="previewUserPhoto(event)">
           <div class="error-msg text-danger small mt-1" id="err_photograph"></div>
        </div>
      </div>
    `;
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
      if (data.success) {
        if (data.serialNo) {
          const sNoDisplay = id('serialNoDisplay');
          if (sNoDisplay) sNoDisplay.textContent = data.serialNo;
        }
        id('successModal').classList.add('active');
        form.reset();
      }
      else alert(data.message);
    } catch (err) { alert('Network error'); }
    finally { submitBtn.disabled = false; submitBtn.textContent = 'Finish & Submit'; }
  });

  function validateStep(sNum) {
    clearAllErrors();
    let isValid = true;

    // Validate photograph only on Step 1 IF it is rendered/active
    if (sNum === 1) {
      const photoInput = id('photograph');
      if (photoInput && !photoInput.files[0]) {
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
        if (/aadhaar|aadhar/.test(fname) && val.length !== 12) {
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

// ── TAMIL PHONETIC TRANSLITERATION (Local Engine — No API needed) ──────────────
// Converts English phonetic typing → Tamil Unicode in real-time
// Example: "vinith kumar" → "விநித் குமார்"
// Tip: use double vowels for long sounds: aa=ஆ, ii=ஈ, uu=ஊ, ee=ஈ

function phoneticToTamil(word) {
  if (!word || !/[a-zA-Z]/.test(word)) return word;

  const low = word.toLowerCase();
  const virama = '்'; // U+0BCD

  // Consonant BASE chars (without virama — added when needed)
  const CONS = [
    ['ksh', 'க்ஷ'], ['ngk', 'ங்க'], ['nch', 'ஞ்ச'],
    ['zh', 'ழ'], ['sh', 'ஷ'], ['th', 'த'], ['dh', 'த'],
    ['tr', 'ற'], ['dr', 'ற'], ['ch', 'ச'],
    ['ng', 'ங'], ['nj', 'ஞ'], ['ny', 'ஞ'],
    ['k', 'க'], ['g', 'க'], ['c', 'ச'], ['j', 'ஜ'],
    ['t', 'ட'], ['d', 'ட'],
    ['n', 'ந'], ['p', 'ப'], ['b', 'ப'], ['f', 'ப'],
    ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['l', 'ல'],
    ['v', 'வ'], ['w', 'வ'], ['s', 'ஸ'], ['h', 'ஹ'],
    ['L', 'ள'], ['R', 'ற'], ['N', 'ண'],
  ];

  // Vowel SIGNS (attached to consonant base)
  const VS = [
    ['aa', 'ா'], ['ee', 'ீ'], ['ii', 'ீ'], ['oo', 'ூ'], ['uu', 'ூ'],
    ['ae', 'ே'], ['ai', 'ை'], ['oa', 'ோ'], ['au', 'ௌ'], ['ow', 'ௌ'],
    ['A', 'ா'], ['E', 'ே'], ['I', 'ீ'], ['O', 'ோ'], ['U', 'ூ'],
    ['i', 'ி'], ['u', 'ு'], ['e', 'ெ'], ['o', 'ொ'],
    ['a', ''],  // inherent vowel — no sign needed
  ];

  // Independent VOWELS (when no preceding consonant)
  const IV = [
    ['aa', 'ஆ'], ['ee', 'ஈ'], ['ii', 'ஈ'], ['oo', 'ஊ'], ['uu', 'ஊ'],
    ['ae', 'ஏ'], ['ai', 'ஐ'], ['oa', 'ஓ'], ['au', 'ஔ'], ['ow', 'ஔ'],
    ['A', 'ஆ'], ['E', 'ஏ'], ['I', 'ஈ'], ['O', 'ஓ'], ['U', 'ஊ'],
    ['i', 'இ'], ['u', 'உ'], ['e', 'எ'], ['o', 'ஒ'], ['a', 'அ'],
  ];

  let result = '';
  let i = 0;
  let pending = null; // pending consonant base

  while (i < low.length) {
    let matched = false;

    // 1. Try consonant (longest match first)
    for (const [pat, base] of CONS) {
      if (low.startsWith(pat, i)) {
        if (pending !== null) result += pending + virama; // close prev consonant
        pending = base;
        i += pat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2. Try vowel (longest match first)
    const vowelList = pending !== null ? VS : IV;
    for (const [pat, sign] of vowelList) {
      if (low.startsWith(pat, i)) {
        if (pending !== null) {
          result += pending + sign; // consonant + vowel sign
          pending = null;
        } else {
          result += sign; // independent vowel
        }
        i += pat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 3. Unknown char — flush pending and pass through
    if (pending !== null) { result += pending + virama; pending = null; }
    result += low[i];
    i++;
  }

  // Flush any trailing consonant
  if (pending !== null) result += pending + virama;
  return result;
}

function initTamilTransliteration() {
  const field = document.getElementById('pupil_name_tamil');
  if (!field) return;

  field.placeholder = '"Name" → பெயர்';
  field.setAttribute('lang', 'ta');
  field.removeAttribute('required'); // Also remove via JS for safety

  // Convert word-by-word as user types spaces (instant result per word)
  field.addEventListener('keydown', function (e) {
    if (e.key === ' ') {
      e.preventDefault();
      const val = this.value;
      // Only convert if it has English chars (pure Tamil words stay untouched)
      if (/[a-zA-Z]/.test(val)) {
        const lastSpaceIdx = val.lastIndexOf(' ');
        const lastWord = val.slice(lastSpaceIdx + 1);
        if (lastWord && /[a-zA-Z]/.test(lastWord)) {
          const converted = phoneticToTamil(lastWord);
          this.value = val.slice(0, lastSpaceIdx + 1) + converted + ' ';
        } else {
          this.value = val + ' ';
        }
      } else {
        this.value = val + ' ';
      }
    }
  });

  // On blur: convert any remaining English word at end
  field.addEventListener('blur', function () {
    const val = this.value.trim();
    if (!val || !/[a-zA-Z]/.test(val)) return;
    // Convert remaining words
    const words = val.split(' ');
    this.value = words.map(w => /[a-zA-Z]/.test(w) ? phoneticToTamil(w) : w).join(' ');
  });
}
