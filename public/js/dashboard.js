// dashboard.js - MCC School Dashboard Logic
let currentPage = 1;
const limit = 10;
const id = (uid) => document.getElementById(uid);

async function showToast(msg) {
  const toast = id('toast');
  const toastMsg = id('toastMsg');
  if (toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStats();
  await loadRecentUsers();

  const toggleBtn = id('toggleSidebar');
  const sidebar = id('sidebar');
  const overlay = id('sidebarOverlay');
  if (toggleBtn && sidebar && overlay) {
    const toggle = () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    };
    toggleBtn.addEventListener('click', toggle);
    overlay.addEventListener('click', toggle);
  }
});

let sortableInstance = null;
let allFields = [];
let activeStepFilter = 0;

function initSortable() {
  const el = document.getElementById('fieldsTbody');
  if (!el || activeStepFilter === 0) return;
  if (sortableInstance) sortableInstance.destroy();

  sortableInstance = Sortable.create(el, {
    handle: '.drag-handle',
    animation: 200,
    onEnd: () => {
      id('saveOrderBtn').style.display = 'inline-flex';
    }
  });
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    animateValue("stat-total", 0, data.total || 0, 1000);
    animateValue("stat-science", 0, data.science || 0, 1000);
    animateValue("stat-commerce", 0, data.commerce || 0, 1000);
    animateValue("stat-others", 0, data.others || 0, 1000);
  } catch (e) { console.error('Stats error:', e); }
}

async function loadRecentUsers() {
  const tbody = id('recentTbody');
  try {
    const res = await fetch('/api/applications?limit=5');
    const data = await res.json();
    const apps = data.applications || [];
    if (!apps.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No applications yet.</td></tr>';
      return;
    }
    tbody.innerHTML = apps.map(app => {
      const date = new Date(app.submitted_at).toLocaleDateString();
      return `
        <tr>
          <td style="font-weight: 600;">${esc(app.pupil_name)}</td>
          <td>${esc(app.admission_class)}</td>
          <td>${esc(app.community)}</td>
          <td><span class="badge" style="background:#f1f5f9; color:#475569;">${esc(app.group_choice)}</span></td>
          <td style="color: #64748b;">${date}</td>
        </tr>
      `;
    }).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error loading data.</td></tr>'; }
}

function showPage(pageId) {
  const sidebar = id('sidebar');
  const overlay = id('sidebarOverlay');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  id('page-' + pageId).classList.add('active');
  document.querySelectorAll('.sb-nav-item').forEach(n => n.classList.remove('active'));
  id('nav-' + pageId).classList.add('active');

  if (pageId === 'applications') loadAllUsers();
  else if (pageId === 'dashboard') { loadStats(); loadRecentUsers(); }
  else if (pageId === 'site-settings') loadSiteSettings();
  else if (pageId === 'form-builder') loadFormFields();
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (!data.authenticated) { window.location.href = '/login.html'; return; }
    id('sbUsername').textContent = data.name || 'mccadmin';
    id('sbAvatar').textContent = (data.name || 'M')[0].toUpperCase();
  } catch (e) { window.location.href = '/login.html'; }
}

async function loadSiteSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    const fields = ['site_title','site_subtitle','site_location','form_title','form_subtitle','footer_text'];
    fields.forEach(f => { if(id('set_'+f)) id('set_'+f).value = s[f] || ''; });
    if(id('logoPreview') && s.logo_path) id('logoPreview').src = s.logo_path + '?t=' + Date.now();
  } catch (e) { console.error('Settings load error', e); }
}

async function saveBrandSettings() {
  const p = { site_title: id('set_site_title').value, site_subtitle: id('set_site_subtitle').value, site_location: id('set_site_location').value };
  await saveSettings(p);
  if(id('sbBrandName')) id('sbBrandName').textContent = p.site_title;
  if(id('sbBrandSub')) id('sbBrandSub').textContent = p.site_subtitle;
  if(id('sbBrandLoc')) id('sbBrandLoc').textContent = p.site_location;
}

async function saveContentSettings() {
  const p = { form_title: id('set_form_title').value, form_subtitle: id('set_form_subtitle').value, footer_text: id('set_footer_text').value };
  await saveSettings(p);
}

async function saveSettings(p) {
  try {
    const res = await fetch('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p) });
    const data = await res.json();
    if (data.success) showToast('Settings saved!');
  } catch (e) { showToast('Save failed'); }
}

async function loadFormFields() {
  try {
    const res = await fetch('/api/form-fields');
    allFields = await res.json();
    filterStep(activeStepFilter);
  } catch (e) { console.error('Fields load error', e); }
}

function filterStep(step) {
  activeStepFilter = step;
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active'));
  id('tab-' + step).classList.add('active');
  const filtered = step === 0 ? allFields : allFields.filter(f => f.step === step);
  renderFieldsTable(filtered);
}

function renderFieldsTable(fields) {
  const tbody = id('fieldsTbody');
  if (!fields.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No fields found for this step.</td></tr>'; return; }
  
  fields.sort((a,b) => (a.step - b.step) || (a.sort_order - b.sort_order));

  tbody.innerHTML = fields.map((f, i) => `
    <tr class="field-row" data-id="${f.id}" data-step="${f.step}" style="border-bottom: 1px solid #f1f5f9;">
      <td class="drag-handle" style="color:#cbd5e1; text-align:center; padding: 12px 0; ${activeStepFilter > 0 ? 'cursor:grab;' : ''}">
        ${activeStepFilter > 0 ? '<i class="fa-solid fa-grip-vertical"></i>' : ''}
      </td>
      <td class="order-label" style="text-align:center; font-size:13px; color:#64748b; font-weight: 500;">${i+1}</td>
      <td style="text-align:center;">
        <span class="badge" style="background:#f1f5f9; color:#475569; font-size:11px; padding: 4px 10px; border-radius: 6px; font-weight: 600;">STEP ${f.step}</span>
      </td>
      <td style="font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size:12px; color: #1e40af; background: #eff6ff; padding: 6px 10px; border-radius: 6px; display: inline-block; margin: 8px 0;">${esc(f.field_name)}</td>
      <td style="font-weight:700; color: #1e293b; font-size: 14px;">${esc(f.label)}</td>
      <td style="text-align:center;">
        <span class="badge" style="background:#f1f5f9; color: #1e293b; text-transform:uppercase; font-size:11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-weight: 700; letter-spacing: 0.5px;">${esc(f.field_type)}</span>
      </td>
      <td style="text-align:center;">
        <i class="fa-solid fa-star" style="font-size: 14px; color: ${f.required ? '#ef4444' : '#e2e8f0'};"></i>
      </td>
      <td style="text-align:right; padding-right: 20px;">
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="action-btn-edit" onclick="openFieldModal(${f.id})" style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; background: #f1f5f9; color: #1e293b; transition: all 0.2s;"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="action-btn-del" onclick="deleteField(${f.id})" style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; background: #fff1f2; color: #be123c; transition: all 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
  initSortable();
}

async function loadAllUsers(offset = 0) {
  currentPage += offset;
  if (currentPage < 1) currentPage = 1;
  const tbody = id('allUsersTbody');
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';
  
  const search = id('searchInput')?.value || '';
  try {
    const res = await fetch(`/api/applications?page=${currentPage}&limit=${limit}&search=${search}`);
    const data = await res.json();
    const apps = data.applications || [];
    
    id('paginationInfo').textContent = `Page ${data.page} of ${Math.ceil(data.total/data.limit) || 1}`;
    id('prevPageBtn').disabled = data.page <= 1;
    id('nextPageBtn').disabled = data.page >= Math.ceil(data.total/data.limit);

    if (!apps.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No users found.</td></tr>'; return; }

    tbody.innerHTML = apps.map(app => `
      <tr>
        <td style="font-weight: 600; color: #1e293b;">${esc(app.pupil_name)}</td>
        <td><span class="badge ${app.group_choice.includes('Science') ? 'badge-student' : 'badge-staff'}">${esc(app.group_choice.split('/')[0] || 'GENERAL')}</span></td>
        <td style="color: #64748b; font-size: 13px;">${esc(app.contact_no_email)}</td>
        <td><span class="badge ${app.status === 'Approved' ? 'badge-active' : 'badge-pending'}">${esc(app.status)}</span></td>
        <td><button class="action-btn" onclick="viewDetail(${app.id})"><i class="fa-solid fa-eye"></i> View</button></td>
      </tr>
    `).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error.</td></tr>'; }
}

function viewDetail(id) {
  const modal = document.getElementById('detailModal');
  const body = document.getElementById('modalBody');
  if (!modal || !body) return;

  // Show loading state
  body.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px; color:maroon;"></i><p style="margin-top:10px; color:#64748b;">Loading application details...</p></div>';
  modal.classList.add('active');

  fetch(`/api/applications/${id}`).then(r => r.json()).then(app => {
    document.getElementById('modalTitle').textContent = "PUPIL ADMISSION DETAIL - " + (app.pupil_name || '').toUpperCase();

    const sections = {
      "SECTION 1: APPLICANT'S INFORMATION": {
        "Pupil Name": app.pupil_name, "Class of Admission": app.admission_class, "Date of Birth": app.dob, "Gender": app.gender, 
        "Blood Group": app.blood_group, "Nationality": app.nationality, "Religion": app.religion, 
        "Caste": app.caste, "Community": app.community, "Mother Tongue": app.mother_tongue,
        "ID Mark 1": app.id_mark_1, "ID Mark 2": app.id_mark_2
      },
      "SECTION 2: CONTACT & PARENTS INFORMATION": {
        "Address for Communication": app.comm_address, "Contact & Email": app.contact_no_email,
        "Father Name": app.father_name, "Father Qualification": app.father_qualification, "Father Occupation": app.father_occupation, "Father Office Address": app.father_office_address, "Father Mobile": app.father_mobile, "Father Landline": app.father_landline, "Father Income": app.father_income,
        "Mother Name": app.mother_name, "Mother Qualification": app.mother_qualification, "Mother Occupation": app.mother_occupation, "Mother Office Address": app.mother_office_address, "Mother Mobile": app.mother_mobile, "Mother Landline": app.mother_landline, "Mother Income": app.mother_income
      },
      "SECTION 3: ACADEMIC HISTORY & SELECTION": {
        "Qualifying Exam": app.qualifying_exam_name, "Year of Passing": app.qualifying_exam_year, 
        "Medium of Instruction": app.medium_of_instruction, "Last School Attended": app.last_school_details,
        "EMIS No": app.emis_no, "Aadhaar No": app.aadhaar_no, "Documents Attached": app.tc_mark_attached,
        "First Language Choice": app.first_language, "Group Applied For": app.group_choice
      },
      "SECTION 4: X STD MARK SHEET DETAILS": {
        "Language": app.marks_lang_val, "English": app.marks_eng_val, "Mathematics": app.marks_math_val,
        "Science": app.marks_sci_val, "Social Science": app.marks_soc_val, "GRAND TOTAL": app.marks_grand_total,
        "Sports/Extra-Curricular": app.credentials
      }
    };

    let html = `
      <div style="background: #fff; border-radius: 12px; margin-bottom: 24px;">
        <div style="display:flex; gap:32px; align-items:center; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="width:140px; height:170px; border:3px solid #fff; background:#fff; display:flex; align-items:center; justify-content:center; border-radius:10px; overflow:hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            ${app.photograph_path ? `<img src="${app.photograph_path}" style="width:100%; height:100%; object-fit:cover;" />` : `<i class="fa-solid fa-user-graduate" style="font-size:60px; color:#cbd5e1;"></i>`}
          </div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <h1 style="margin:0; font-size:32px; font-weight:800; color:#1e293b; letter-spacing:-0.5px;">${esc(app.pupil_name)}</h1>
                <p style="margin:4px 0 12px; color:#64748b; font-size:16px; font-weight:500;"><i class="fa-solid fa-calendar-check"></i> Academic Year: <span style="color:maroon;">${esc(app.academic_year || '2026-2027')}</span></p>
                <div style="display:flex; gap:12px;">
                   <span class="badge ${app.status === 'Approved' ? 'badge-active' : 'badge-pending'}" style="font-size:13px; padding:6px 16px;">INTERNAL STATUS: ${app.status}</span>
                   <span class="badge" style="background:#f1f5f9; color:#475569; font-size:13px; padding:6px 16px;">SERIAL NO: ${app.serial_no || 'Pending'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style="display:grid; gap:32px;">`;
    
    for (const [title, fields] of Object.entries(sections)) {
      html += `<div style="background:white; border:1px solid #f1f5f9; border-radius:12px; padding:0; overflow:hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
        <div style="background:#8B1A2E; color:white; padding:12px 20px; font-size:14px; font-weight:700; letter-spacing:0.5px;">${title}</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1px; background:#f1f5f9;">`;
      for (const [label, val] of Object.entries(fields)) {
        html += `<div style="background:white; padding:16px 20px;">
          <span style="display:block; font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.3px;">${label}</span>
          <span style="font-weight:600; font-size:15px; color:#1e293b; line-height:1.4;">${esc(val) || '—'}</span>
        </div>`;
      }
      html += `</div></div>`;
    }
    html += '</div>';
    
    body.innerHTML = html + `
      <div style="margin-top:40px; padding:24px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px; color:#64748b;">
          <i class="fa-solid fa-clock-rotate-left" style="font-size:20px;"></i>
          <div>
            <p style="margin:0; font-size:13px; font-weight:600;">Submitted On</p>
            <p style="margin:0; font-size:12px;">${new Date(app.submitted_at).toLocaleString()}</p>
          </div>
        </div>
        <div style="display:flex; gap:16px;">
          <button class="btn" style="background:#00ba7c; color:white; padding:12px 28px; border-radius:8px; font-weight:700; border:none; cursor:pointer;" onclick="updateStatus(${app.id}, 'Approved')"><i class="fa-solid fa-check-circle"></i> APPROVE ADMISSION</button>
          <button class="btn" style="background:#ef4444; color:white; padding:12px 28px; border-radius:8px; font-weight:700; border:none; cursor:pointer;" onclick="updateStatus(${app.id}, 'Rejected')"><i class="fa-solid fa-times-circle"></i> REJECT APPLICATION</button>
        </div>
      </div>
    `;
    modal.querySelector('.modal').style.maxWidth = '1200px';
  }).catch(err => {
    body.innerHTML = `<div style="text-align:center; padding:50px; color:#ef4444;"><i class="fa-solid fa-circle-exclamation" style="font-size:48px;"></i><p style="margin-top:10px; font-weight:600;">Failed to load details. Please try again.</p></div>`;
  });
}

async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/applications/${id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) });
    if(res.ok) { showToast('Status updated!'); closeDetailModal(); loadAllUsers(); loadStats(); }
  } catch(e) { showToast('Update failed'); }
}

async function exportToExcel() {
  try {
    const res = await fetch('/api/applications?limit=10000');
    const data = await res.json();
    const worksheet = XLSX.utils.json_to_sheet(data.applications);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Admissions");
    XLSX.writeFile(workbook, "MCC_School_Admissions_Full_Report.xlsx");
  } catch (e) { showToast('Export failed'); }
}

function closeDetailModal() { id('detailModal').classList.remove('active'); }
function changePage(o) { loadAllUsers(o); }
function animateValue(id, s, e, d) {
  const o = document.getElementById(id); if (!o) return;
  let start = null;
  const step = (t) => {
    if (!start) start = t;
    const progress = Math.min((t - start) / d, 1);
    o.innerHTML = Math.floor(progress * (e - s) + s);
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}
function handleLogout() { fetch('/api/logout', {method:'POST'}).then(() => window.location.href='/login.html'); }
function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

// ── FIELD MODAL ──
function openFieldModal(fieldId) {
  const modal = id('fieldModal');
  if (!modal) return;

  // Reset form
  ['fld_id','fld_name','fld_label','fld_options'].forEach(x => { if(id(x)) id(x).value = ''; });
  if(id('fld_step')) id('fld_step').value = '1';
  if(id('fld_type')) id('fld_type').value = 'text';
  if(id('fld_width')) id('fld_width').value = '6';
  if(id('fld_required')) id('fld_required').checked = true;
  id('row_field_name') && (id('row_field_name').style.display = 'block');
  id('row_options') && (id('row_options').style.display = 'none');
  id('fieldModalTitle').textContent = fieldId ? 'Edit Field' : 'Add New Field';

  if (fieldId) {
    fetch(`/api/form-fields/${fieldId}`).then(r => r.json()).then(f => {
      id('fld_id').value = f.id;
      id('fld_step').value = f.step;
      if(id('fld_type')) id('fld_type').value = f.field_type;
      id('fld_name').value = f.field_name;
      id('fld_label').value = f.label;
      if(id('fld_options')) id('fld_options').value = f.options || '';
      if(id('fld_width')) id('fld_width').value = f.column_width || 6;
      if(id('fld_required')) id('fld_required').checked = !!f.required;
      id('row_field_name').style.display = 'none'; // Can't rename DB key
      if (f.field_type === 'select') id('row_options') && (id('row_options').style.display = 'block');
      modal.classList.add('active');
    });
  } else {
    modal.classList.add('active');
  }

  // Show/hide options row on type change
  const typeSelect = id('fld_type');
  if (typeSelect) {
    typeSelect.onchange = () => {
      id('row_options') && (id('row_options').style.display = typeSelect.value === 'select' ? 'block' : 'none');
    };
  }
}

function closeFieldModal() { id('fieldModal') && id('fieldModal').classList.remove('active'); }

async function saveField() {
  const fid = id('fld_id')?.value;
  const body = {
    step: parseInt(id('fld_step')?.value || '1'),
    field_type: id('fld_type')?.value || 'text',
    field_name: id('fld_name')?.value?.trim(),
    label: id('fld_label')?.value?.trim(),
    placeholder: '',
    required: id('fld_required')?.checked ? 1 : 0,
    options: id('fld_options')?.value?.trim() || null,
    column_width: parseInt(id('fld_width')?.value || '6'),
    sort_order: 99
  };

  if (!body.label) { showToast('Label is required'); return; }

  try {
    let res;
    if (fid) {
      res = await fetch(`/api/form-fields/${fid}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    } else {
      if (!body.field_name) { showToast('DB Key is required'); return; }
      res = await fetch('/api/form-fields', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    }
    const data = await res.json();
    if (data.success) {
      showToast(fid ? 'Field updated!' : 'Field added!');
      closeFieldModal();
      loadFormFields();
    } else {
      showToast(data.message || 'Save failed');
    }
  } catch (e) { showToast('Error saving field'); }
}

async function deleteField(fid) {
  if (!confirm('Delete this field? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/form-fields/${fid}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showToast('Field deleted!'); loadFormFields(); }
    else showToast('Delete failed');
  } catch (e) { showToast('Error deleting field'); }
}

async function saveFieldsOrder() {
  const rows = document.querySelectorAll('#fieldsTbody .field-row');
  const order = Array.from(rows).map((row, idx) => ({ id: parseInt(row.dataset.id), sort_order: idx + 1 }));
  try {
    const res = await fetch('/api/form-fields-order', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ order }) });
    const data = await res.json();
    if (data.success) {
      showToast('Order saved!');
      id('saveOrderBtn').style.display = 'none';
      loadFormFields();
    }
  } catch (e) { showToast('Error saving order'); }
}

