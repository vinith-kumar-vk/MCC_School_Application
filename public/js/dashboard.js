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
  await loadFormsList(); // First load the forms
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
let forms = [];

async function loadFormsList() {
  try {
    const res = await fetch('/api/forms');
    forms = await res.json();
    const selectors = ['dashboardFormFilter', 'applicationsFormFilter', 'builderFormSelector'];
    selectors.forEach(sid => {
      const el = id(sid);
      if (el) {
        const currentVal = el.value;
        el.innerHTML = (sid === 'builderFormSelector' ? '' : '<option value="">All Applications</option>') +
          forms.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        if (currentVal) el.value = currentVal;
      }
    });
  } catch (e) { console.error('Forms load error', e); }
}

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
    const formId = id('dashboardFormFilter')?.value || '';
    const res = await fetch(`/api/stats?formId=${formId}`);
    const data = await res.json();
    animateValue("stat-total", 0, data.total || 0, 1000);
    // Note: detailed stats (science/commerce) are now form-specific, 
    // for now we set them to 0 or hide if no specific logic exists
    animateValue("stat-science", 0, 0, 1000);
    animateValue("stat-commerce", 0, 0, 1000);
    animateValue("stat-others", 0, 0, 1000);
  } catch (e) { console.error('Stats error:', e); }
}

async function loadRecentUsers() {
  const tbody = id('recentTbody');
  const formId = id('dashboardFormFilter')?.value || '';
  try {
    const res = await fetch(`/api/applications?limit=5&formId=${formId}`);
    const data = await res.json();
    const apps = data.applications || [];
    if (!apps.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No applications yet.</td></tr>';
      return;
    }
    tbody.innerHTML = apps.map(app => {
      const date = new Date(app.submitted_at).toLocaleDateString();
      const d = app.form_data || {};
      const displayClass = d.class_registered || d.admission_class || 'N/A';
      return `
        <tr>
          <td style="font-weight: 600;">${esc(d.pupil_name || 'N/A')}</td>
          <td>${esc(displayClass)}</td>
          <td>${esc(d.community || 'N/A')}</td>
          <td><span class="badge" style="background:#f1f5f9; color:#475569; font-size:11px;">${esc(app.form_name)}</span></td>
          <td style="color: #64748b;">${date}</td>
        </tr>
      `;
    }).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error loading data.</td></tr>'; }
}

function showPage(pageId) {
  console.log('Switching to page:', pageId);
  const sidebar = id('sidebar');
  const overlay = id('sidebarOverlay');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
  
  const targetPage = id('page-' + pageId);
  const targetNav = id('nav-' + pageId);
  
  if (!targetPage) {
    console.error('Page element not found: page-' + pageId);
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  targetPage.classList.add('active');
  
  document.querySelectorAll('.sb-nav-item').forEach(n => n.classList.remove('active'));
  if (targetNav) targetNav.classList.add('active');

  if (pageId === 'applications') loadAllUsers();
  else if (pageId === 'dashboard') { loadStats(); loadRecentUsers(); }
  else if (pageId === 'site-settings') loadSiteSettings();
  else if (pageId === 'form-builder') loadFormFields();
  else if (pageId === 'users') loadUsers();
  else if (pageId === 'roles') loadRoles();
}

let currentUser = null;

async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (!data.authenticated) { window.location.href = '/login.html'; return; }
    currentUser = data;
    
    // Hard force for root/admin
    const isSuper = (data.isSuper == true || data.isSuper == 1 || data.username === 'mccmrfadmin');
    const roleName = (data.roleName || 'Administrator').toLowerCase();
    const isPowerAdmin = isSuper || roleName === 'super admin' || roleName === 'root';
    
    id('sbUsername').textContent = data.name || 'MCC Admin';
    id('sbAvatar').innerHTML = isSuper ? '<i class="fa-solid fa-crown" style="color:#f59e0b;"></i>' : (data.name || 'M')[0].toUpperCase();
    const roleEl = id('sbUserRole');
    roleEl.textContent = isSuper ? 'Super Admin (Root)' : (data.roleName || 'Administrator');
    
    if (isSuper || roleName.includes('super')) {
        roleEl.style.color = '#f59e0b';
        roleEl.style.fontWeight = '800';
    }
    
    // Permission based sidebar item visibility
    const navItems = {
      'nav-site-settings': 'settings:view',
      'nav-form-builder': 'forms:view',
      'nav-users': 'users:view',
      'nav-roles': 'roles:view'
    };
    
    let hasAdminAccess = false;
    Object.entries(navItems).forEach(([navId, perm]) => {
      const el = id(navId);
      if (el) {
        const canSee = isSuper || isPowerAdmin || (data.permissions && (data.permissions.includes('*') || data.permissions.includes(perm)));
        el.style.display = canSee ? 'flex' : 'none';
        if (canSee && (navId === 'nav-users' || navId === 'nav-roles')) hasAdminAccess = true;
      }
    });
    
    // Header/Divider visibility
    if (id('divider-platform')) id('divider-platform').style.display = hasAdminAccess ? 'block' : 'none';
    if (id('title-platform')) id('title-platform').style.display = hasAdminAccess ? 'block' : 'none';

  } catch (e) { window.location.href = '/login.html'; }
}

function hasPerm(perm) {
  if (!currentUser) return false;
  return currentUser.isSuper || (currentUser.permissions && currentUser.permissions.includes(perm));
}

async function loadSiteSettings() {
  try {
    const res = await fetch('/api/settings?t=' + Date.now());
    const s = await res.json();
    const fields = ['site_title', 'site_subtitle', 'site_location', 'site_contact', 'landing_title', 'form_title', 'form_subtitle', 'footer_text', 'btn1_label', 'btn2_label', 'form1_title', 'form2_title', 'admission_year'];
    fields.forEach(f => { if (id('set_' + f)) id('set_' + f).value = s[f] || ''; });
    if (id('logoPreview') && s.logo_path) id('logoPreview').src = s.logo_path + '?t=' + Date.now();
    
    // Permission checks for settings
    const saveBtns = document.querySelectorAll('.cms-save-btn');
    saveBtns.forEach(btn => {
      // Branding and CMS save buttons
      if (btn.onclick && (btn.onclick.toString().includes('saveBrandSettings') || 
                          btn.onclick.toString().includes('saveLandingPageSettings') || 
                          btn.onclick.toString().includes('saveFormGlobalSettings') ||
                          btn.onclick.toString().includes('uploadLogo'))) {
        btn.style.display = hasPerm('settings:edit') ? 'block' : 'none';
      }
    });
    
    const uploadLabel = document.querySelector('.cms-upload-btn');
    if (uploadLabel) uploadLabel.style.display = hasPerm('settings:edit') ? 'inline-block' : 'none';

  } catch (e) { console.error('Settings load error', e); }
}


async function saveBrandSettings() {
  const p = {
    site_title: id('set_site_title').value,
    site_location: id('set_site_location').value,
    site_contact: id('set_site_contact').value
  };
  await saveSettings(p);
  if (id('sbBrandName')) id('sbBrandName').textContent = p.site_title;
  if (id('sbBrandLoc')) id('sbBrandLoc').textContent = p.site_location;
}

async function saveLandingPageSettings() {
  const p = {
    site_subtitle: id('set_site_subtitle').value,
    landing_title: id('set_landing_title').value,
    form_subtitle: id('set_form_subtitle').value,
    footer_text: id('set_footer_text').value,
    btn1_label: id('set_btn1_label').value,
    btn2_label: id('set_btn2_label').value
  };
  await saveSettings(p);
}

async function saveFormGlobalSettings() {
  let cycleVal = (id('set_admission_year').value || '').trim();

  // Guard: if admin accidentally pastes full serial like "MCC/2026 - 2031/0001"
  // strip it down to just the year part "2026 - 2031"
  if (cycleVal.toUpperCase().startsWith('MCC/')) {
    // Extract middle part: MCC/<cycle>/<seq> → <cycle>
    const parts = cycleVal.split('/');
    if (parts.length >= 2) cycleVal = parts[1].trim();
  }
  // Also reject if it contains no digit range pattern at all
  if (cycleVal && !/^\d{4}/.test(cycleVal)) {
    showToast('⚠️ Admission Cycle must be in format: 2026 - 2031');
    return;
  }

  const p = {
    form1_title: id('set_form1_title').value,
    form2_title: id('set_form2_title').value,
    admission_year: cycleVal
  };
  // Update input field to show the cleaned value
  id('set_admission_year').value = cycleVal;
  await saveSettings(p);
}


async function saveSettings(p) {
  try {
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    const data = await res.json();
    if (data.success) { showToast('Settings saved!'); loadSiteSettings(); }
  } catch (e) { showToast('Save failed'); }
}


function previewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => id('logoPreview').src = e.target.result;
  reader.readAsDataURL(file);
}

async function uploadLogo() {
  const file = id('logoFileInput').files[0];
  if (!file) return showToast('Please select a file');
  const fd = new FormData();
  fd.append('logo', file);
  try {
    const res = await fetch('/api/upload-logo', { method: 'POST', body: fd });
    let data;
    try { data = await res.json(); } catch (jsonErr) {
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      throw jsonErr;
    }

    if (data.success) {
      showToast('Logo updated successfully!');
      setTimeout(() => loadSiteSettings(), 500);
    } else {
      showToast('Upload failed: ' + (data.message || 'Unknown error'));
    }
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Upload failed. Check server console.');
  }
}




async function loadFormFields() {
  try {
    const formId = id('builderFormSelector')?.value;
    if (!formId) return;
    const res = await fetch(`/api/form-fields?formId=${formId}&admin=true`);
    allFields = await res.json();
    filterStep(activeStepFilter);
  } catch (e) { console.error('Fields load error', e); }
}

function loadFields() { loadFormFields(); } // Alias for selector change

function filterStep(step) {
  activeStepFilter = step;
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active'));
  id('tab-' + step).classList.add('active');
  const filtered = step === 0 ? allFields : allFields.filter(f => f.step === step);
  
  // Permission checks for top buttons
  const addBtn = document.querySelector('button[onclick="openFieldModal(null)"]');
  if (addBtn) addBtn.style.display = hasPerm('forms:edit') ? 'flex' : 'none';
  
  const editPropBtn = document.querySelector('button[onclick="openFormSettingsModal()"]');
  if (editPropBtn) editPropBtn.style.display = hasPerm('forms:edit') ? 'flex' : 'none';

  renderFieldsTable(filtered);
}

function renderFieldsTable(fields) {
  const tbody = id('fieldsTbody');
  if (!fields.length) { tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No fields found for this step.</td></tr>'; return; }

  fields.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));

  tbody.innerHTML = fields.map((f, i) => `
    <tr class="field-row" data-id="${f.id}" data-step="${f.step}" style="border-bottom: 1px solid #f1f5f9; ${f.is_active ? '' : 'opacity: 0.6; background: #fafafa;'}">
      <td class="drag-handle" style="color:#cbd5e1; text-align:center; padding: 12px 0; ${activeStepFilter > 0 ? 'cursor:grab;' : ''}">
        ${activeStepFilter > 0 ? '<i class="fa-solid fa-grip-vertical"></i>' : ''}
      </td>
      <td class="order-label" style="text-align:center; font-size:13px; color:#64748b; font-weight: 500;">${f.sort_order}</td>
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
      <td style="text-align:center;">
        <label class="switch" style="${hasPerm('forms:edit') ? '' : 'pointer-events:none; opacity:0.5;'}">
          <input type="checkbox" ${f.is_active ? 'checked' : ''} onchange="toggleFieldStatus(${f.id}, this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td style="text-align:right; padding-right: 20px;">
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          ${hasPerm('forms:edit') ? `
            <button class="action-btn-edit" onclick="openFieldModal(${f.id})" style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; background: #f1f5f9; color: #1e293b; transition: all 0.2s;"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="action-btn-del" onclick="deleteField(${f.id})" style="width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; background: #fff1f2; color: #be123c; transition: all 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
          ` : '<span style="color:#cbd5e1; font-size:12px;">View Only</span>'}
        </div>
      </td>
    </tr>
  `).join('');
  initSortable();
}

async function toggleFieldStatus(fid, isActive) {
  try {
    const res = await fetch(`/api/form-fields/${fid}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive ? 1 : 0 })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isActive ? 'Field enabled' : 'Field hidden from form');
      loadFormFields();
    } else {
      showToast('Toggle failed: ' + (data.message || 'Unknown error'));
      loadFormFields(); // Refresh to revert UI state
    }
  } catch (e) { 
    showToast('Network error in toggle'); 
    loadFormFields();
  }
}

async function loadAllUsers(offset = 0) {
  currentPage += offset;
  if (currentPage < 1) currentPage = 1;
  const tbody = id('allUsersTbody');
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';

  const search = id('searchInput')?.value || '';
  const formId = id('applicationsFormFilter')?.value || '';
  try {
    const res = await fetch(`/api/applications?page=${currentPage}&limit=${limit}&search=${search}&formId=${formId}`);
    const data = await res.json();
    const apps = data.applications || [];

    id('paginationInfo').textContent = `Page ${data.page} of ${Math.ceil(data.total / data.limit) || 1}`;
    id('prevPageBtn').disabled = data.page <= 1;
    id('nextPageBtn').disabled = data.page >= Math.ceil(data.total / data.limit);

    if (!apps.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No entries found.</td></tr>'; return; }

    tbody.innerHTML = apps.map(app => {
      const d = app.form_data || {};
      const displayClass = d.class_registered || d.admission_class || 'N/A';
      return `
            <tr>
                <td style="font-weight: 600; color: #1e293b;">${esc(d.pupil_name || 'N/A')}</td>
                <td><span style="font-weight:500; color:#475569;">${esc(displayClass)}</span></td>
                <td><span class="badge badge-staff">${esc(app.form_name)}</span></td>
                <td><span class="badge ${app.status === 'Approved' ? 'badge-active' : 'badge-pending'}">${esc(app.status)}</span></td>
                <td><button class="action-btn" onclick="viewDetail(${app.id})"><i class="fa-solid fa-eye"></i> View</button></td>
            </tr>
        `;
    }).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error.</td></tr>'; }
}

function viewDetail(id) {
  const modal = document.getElementById('detailModal');
  const body = document.getElementById('modalBody');
  if (!modal || !body) return;

  body.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px; color:maroon;"></i><p style="margin-top:10px; color:#64748b;">Loading...</p></div>';
  modal.classList.add('active');

  // Use Promise.all to fetch application and its form field config
  Promise.all([
    fetch(`/api/applications/${id}`).then(r => r.json()),
    fetch(`/api/settings`).then(r => r.json())
  ]).then(async ([app, settings]) => {
    window.currentAppPrintData = app;
    const d = app.form_data || {};
    document.getElementById('modalTitle').textContent = "PUPIL DETAIL - " + (d.pupil_name || '').toUpperCase();

    // Check if photograph field is active for this form
    let showPhotoBox = !!app.photograph_path;
    try {
      const fieldRes = await fetch(`/api/form-fields?formId=${app.form_id}&admin=true`);
      const fields = await fieldRes.json();
      const photoField = fields.find(f => f.field_type === 'photograph');
      if (photoField && photoField.is_active === 0 && !app.photograph_path) {
        showPhotoBox = false;
      } else if (!photoField && !app.photograph_path) {
        showPhotoBox = false;
      }
    } catch(e) { console.error(e); }

    let html = `
      <div style="background: #fff; border-radius: 12px; margin-bottom: 24px;">
        <div style="display:flex; gap:32px; align-items:center; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
          ${showPhotoBox ? `
          <div style="width:140px; height:170px; border:3px solid #fff; background:#fff; display:flex; align-items:center; justify-content:center; border-radius:10px; overflow:hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            ${app.photograph_path ? `<img src="${app.photograph_path}" style="width:100%; height:100%; object-fit:cover;" />` : `<i class="fa-solid fa-user-graduate" style="font-size:60px; color:#cbd5e1;"></i>`}
          </div>` : ''}
          <div style="flex:1;">
            <div>
              <h1 style="margin:0; font-size:32px; font-weight:800; color:#1e293b; letter-spacing:-0.5px;">${esc(d.pupil_name || 'N/A')}</h1>
              <p style="margin:4px 0 12px; color:#64748b; font-size:16px;"><i class="fa-solid fa-file-alt"></i> Form: <span style="color:maroon; font-weight:bold;">${esc(app.form_name)}</span></p>
               <div style="display:flex; gap:12px; align-items:center;">
                  <span class="badge ${app.status === 'Approved' ? 'badge-active' : 'badge-pending'}">STATUS: ${app.status}</span>
                  <div id="serialEditContainer" style="display:flex; align-items:center; gap:8px; background:#f1f5f9; padding:4px 12px; border-radius:100px; border:1px solid #e2e8f0;">
                    <span style="font-size:11px; font-weight:700; color:#475569;">ADMISSION NO:</span>
                    <span id="serialText" style="font-weight:700; color:#1e293b; font-size:13px;">${esc(app.serial_no || 'N/A')}</span>
                    ${hasPerm('applications:edit') ? `<button onclick="enableSerialEdit(${app.id}, '${esc(app.serial_no || '')}')" style="background:none; border:none; color:maroon; cursor:pointer; font-size:12px; padding:0 4px;"><i class="fa-solid fa-pen"></i></button>` : ''}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1px; background:#f1f5f9; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">`;

    for (const [label, val] of Object.entries(d)) {
      html += `<div style="background:white; padding:16px 20px;">
        <span style="display:block; font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:6px;">${esc(label.replace(/_/g, ' '))}</span>
        <span style="font-weight:600; font-size:15px; color:#1e293b;">${esc(val) || '—'}</span>
      </div>`;
    }

    body.innerHTML = html + `</div>
      <div style="margin-top:40px; padding:24px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px; color:#64748b;">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <div>
            <p style="margin:0; font-size:13px; font-weight:600;">Submitted On</p>
            <p style="margin:0; font-size:12px;">
              ${(() => {
                // Ensure the date is treated as UTC from the DB
                const dateStr = app.submitted_at;
                const date = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : ' UTC'));
                const timeStr = date.toLocaleString();
                const tzStr = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const tzName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date).find(p => p.type === 'timeZoneName').value;
                return `${timeStr} (${tzName})`;
              })()}
            </p>
          </div>
        </div>
        <div style="display:flex; gap:16px;">
          <button class="btn" style="background:#78091E; color:white; padding:10px 24px; border-radius:8px; border:none; cursor:pointer; font-weight:700; display:flex; align-items:center; gap:8px;" onclick="printApplicationPDF()">
             <i class="fa-solid fa-file-pdf"></i> PRINT PDF
          </button>
          ${hasPerm('applications:edit') ? `
            <button class="btn" style="background:#00ba7c; color:white; padding:10px 20px; border-radius:8px; border:none; cursor:pointer;" onclick="updateStatus(${app.id}, 'Approved')">APPROVE</button>
            <button class="btn" style="background:#ef4444; color:white; padding:10px 20px; border-radius:8px; border:none; cursor:pointer;" onclick="updateStatus(${app.id}, 'Rejected')">REJECT</button>
          ` : ''}
        </div>
      </div>
    `;
  }).catch(err => {
    body.innerHTML = `<div style="text-align:center; padding:50px; color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i><p>Failed to load data.</p></div>`;
  });
}

async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/applications/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { showToast('Status updated!'); viewDetail(id); loadAllUsers(); loadStats(); }
  } catch (e) { showToast('Update failed'); }
}

function enableSerialEdit(appId, currentSerial) {
  const container = id('serialEditContainer');
  if (!container) return;
  container.innerHTML = `
    <input type="text" id="editSerialInput" value="${esc(currentSerial)}" style="border:1px solid maroon; border-radius:4px; padding:2px 8px; font-size:12px; width:140px; font-weight:700;">
    <button onclick="saveSerial(${appId})" style="background:maroon; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:11px; font-weight:700;">SAVE</button>
    <button onclick="viewDetail(${appId})" style="background:#cbd5e1; color:#1e293b; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:11px; font-weight:700;">X</button>
  `;
}

async function saveSerial(id) {
  const newSerial = document.getElementById('editSerialInput')?.value;
  if (!newSerial) return showToast('Admission No cannot be empty');
  try {
    const res = await fetch(`/api/applications/${id}/serial`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial: newSerial })
    });
    if (res.ok) {
      showToast('Admission No updated!');
      viewDetail(id); // Reload the detailed view
      loadAllUsers(); // Reload the main table listing
    }
  } catch (e) { showToast('Update failed'); }
}

async function printApplicationPDF() {
  if (!window.currentAppPrintData) return showToast('No data to print. Please refresh application.');

  showToast('Generating Premium Application PDF...');

  const app = window.currentAppPrintData;
  const d = app.form_data || {};
  const safeName = String(app.serial_no || app.id).replace(/[^a-zA-Z0-9]/g, '_');
  const baseUrl = window.location.origin;

  // Fetch field metadata to ensure correct order and labels
  let fieldMeta = [];
  let photoActive = false;
  try {
    const metaRes = await fetch(`/api/form-fields?formId=${app.form_id}&admin=true`);
    fieldMeta = await metaRes.json();
    const photoField = fieldMeta.find(f => f.field_type === 'photograph');
    photoActive = photoField ? (photoField.is_active === 1) : false;
  } catch (e) { console.error('Meta fetch failed', e); }

  const logoUrl = baseUrl + '/images/pdf_logo.png';
  const logoBase64 = await getBase64ImageFromUrl(logoUrl) || logoUrl;

  let photoReady = null;
  // Only try to show photo if the field is active OR there is an existing path
  if (app.photograph_path && (photoActive || app.photograph_path)) {
    let rawPhotoUrl = app.photograph_path;
    if (rawPhotoUrl.startsWith('/')) rawPhotoUrl = baseUrl + rawPhotoUrl;
    else if (!rawPhotoUrl.startsWith('http')) rawPhotoUrl = baseUrl + '/' + rawPhotoUrl;
    rawPhotoUrl = rawPhotoUrl.replace(/([^:]\/)\/+/g, "$1");
    photoReady = await getBase64ImageFromUrl(rawPhotoUrl);
  }

  // Dynamic Class Logic based on Form ID
  let classSuffix = (app.form_id == 1) ? '(Pre-kg, LKG & UKG)' : '(XI)';

  const dateStr = new Date(app.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Arrange fields based on metadata if available, otherwise fallback to data keys
  let orderedFields = [];
  const cleanLabel = (lbl) => lbl.replace(/^\d+\.\s*([a-z]\.\s+)?/, '').trim();

  if (fieldMeta.length > 0) {
    fieldMeta.forEach(fm => {
      if (d[fm.field_name] !== undefined) {
        orderedFields.push([cleanLabel(fm.label), d[fm.field_name]]);
      }
    });
    // Add any missing fields
    Object.entries(d).forEach(([k, v]) => {
      if (!fieldMeta.find(fm => fm.field_name === k) && k.toLowerCase() !== 'pupil_name' && !k.toLowerCase().includes('declaration')) {
        orderedFields.push([cleanLabel(k.replace(/_/g, ' ')), v]);
      }
    });
  } else {
    orderedFields = Object.entries(d)
      .filter(([k, v]) => k.toLowerCase() !== 'pupil_name' && !k.toLowerCase().includes('declaration'))
      .map(([k, v]) => [cleanLabel(k.replace(/_/g, ' ')), v]);
  }

  // Logical Split: Form 1 split after Father Occupation usually.
  const splitIndex = 22;
  const p1Fields = orderedFields.slice(0, splitIndex);
  const p2Fields = orderedFields.slice(splitIndex);

  function makeFieldTable(fields) {
    let rows = '';
    fields.forEach(([label, val]) => {
      rows += `
        <tr>
          <td style="padding:6.2px 12px; border:1px solid #78091E; font-size:8pt; font-weight:bold; color:#444; text-transform:uppercase; background:#fdfdfd; width:44%;">${label}</td>
          <td style="padding:6.2px 12px; border:1px solid #78091E; font-size:9pt; color:#000; width:56%; font-weight:700;">${esc(val) || '—'}</td>
        </tr>
      `;
    });
    return `<table style="width:100%; border-collapse:collapse; margin-top:0;">${rows}</table>`;
  }

  const opt = {
    margin: [0, 0, 0, 0],
    filename: `Application_${safeName}.pdf`,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: { scale: 3, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'css', before: '.page-break' }
  };

  const printDiv = document.createElement('div');
  printDiv.style.width = '794px';
  printDiv.style.fontFamily = "'Inter', Georgia, serif";

  const headerHtml = `
    <table style="width:100%; border-collapse:collapse; margin-bottom:8px; border-bottom:1.8px solid #78091E; padding-bottom:8px;">
      <tr>
        <td style="width:80px; vertical-align:middle;"><img src="${logoBase64}" style="width:75px; height:auto; display:block;"></td>
        <td style="text-align:center; vertical-align:middle;">
           <div style="color:#78091E; font-size:18pt; font-weight:900; line-height:1.0; text-transform:uppercase;">MCC CAMPUS</div>
           <div style="color:#78091E; font-size:11pt; font-weight:900; line-height:1.2; margin-top:3px; text-transform:uppercase;">MATRICULATION HIGHER SECONDARY SCHOOL</div>
           <div style="margin-top:5px; font-size:10pt; font-weight:900; color:#1a1a1a; text-decoration: underline; text-transform:uppercase;">APPLICATION FOR ADMISSION ${classSuffix}</div>
        </td>
        <td style="width:80px;"></td>
      </tr>
    </table>`;

  const outerBase = "box-sizing:border-box; width:100%; height:1121px; background:#fff; position:relative; overflow:hidden; padding: 6mm;";
  const innerStyle = "box-sizing:border-box; border: 2.2px solid #78091E; padding: 8mm; height: 100%; background:#fff; position:relative; display:flex; flex-direction:column;";

  // Conditionally render the photo cell in the PDF header table
  const photoCellHtml = (photoActive || app.photograph_path) ? `
    <td style="width:140px; text-align:right; vertical-align:top;">
      <div style="width:125px; height:155px; border:1.5px solid #78091E; padding:1px; background:#fcfcfc; margin-left:auto;">
        ${photoReady ? `<img src="${photoReady}" style="width:100%; height:100%; object-fit:cover; display:block;">` : `<div style="text-align:center; padding-top:60px; color:#ddd; font-weight:bold; font-size:8pt;">PHOTO</div>`}
      </div>
    </td>` : '';

  // Construct as a single tight string to avoid character-gap page breaks
  printDiv.innerHTML = `<div style="${outerBase}"><div style="${innerStyle}">${headerHtml}<table style="width:100%; margin: 6px 0 10px 0; border-collapse:collapse;"><tr><td style="vertical-align:top;"><div style="margin-bottom:10px; border-bottom:1px dashed #eee; padding-bottom:8px;"><span style="font-size:8.5pt; font-weight:700; color:#666; text-transform:uppercase; margin-right:10px;">NAME OF THE APPLICANT:</span><span style="font-size:17pt; font-weight:900; color:#78091E; text-transform:uppercase; letter-spacing:-0.2px;">${esc(d.pupil_name || d.PUPIL_NAME || 'N/A')}</span></div><table style="width:100%;"><tr><td style="width:50%;"><div style="font-size:8pt; color:#666; font-weight:bold; text-transform:uppercase;">ADMISSION NO</div><div style="font-size:12pt; color:#000; font-weight:900; margin-top:1px;">${app.serial_no || app.id}</div></td><td style="width:50%;"><div style="font-size:8pt; color:#666; font-weight:bold; text-transform:uppercase;">APPLICATION DATE</div><div style="font-size:12pt; color:#000; font-weight:900; margin-top:1px;">${dateStr}</div></td></tr></table></td>${photoCellHtml}</tr></table><div style="background:#78091E; color:#fff; font-size:10pt; font-weight:900; padding:4px 15px; text-transform:uppercase; letter-spacing:0.5px;">APPLICANT PROFILE - PART I</div><div style="flex:1;">${makeFieldTable(p1Fields)}</div></div></div><div class="page-break" style="${outerBase}"><div style="${innerStyle}"><div style="background:#78091E; color:#fff; font-size:10pt; font-weight:900; padding:4px 15px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0;">APPLICANT PROFILE - PART II</div><div style="flex:1;">${makeFieldTable(p2Fields)}<div style="margin-top:20px; border: 1.5px dashed #78091E; padding: 12px; border-radius: 4px;"><div style="font-size:9.5pt; font-weight:900; color:#78091E; text-align:center; text-transform:uppercase; margin-bottom:10px; text-decoration:underline;">OFFICE USE ONLY</div><table style="width:100%; border-collapse:collapse; font-size:8.5pt;"><tr><td style="padding:6px 10px; border:1px solid #eee; width:40%; font-weight:bold; color:#555;">Admission Status:</td><td style="padding:6px 10px; border:1px solid #eee; width:60%; font-weight:600; color:#000;">PROVISIONAL / CONFIRMED</td></tr><tr><td style="padding:6px 10px; border:1px solid #eee; font-weight:bold; color:#555;">Date of Admission:</td><td style="padding:6px 10px; border:1px solid #eee;">____ / ____ / 202____</td></tr><tr><td style="padding:6px 10px; border:1px solid #eee; font-weight:bold; color:#555;">Admitted Class & Section:</td><td style="padding:6px 10px; border:1px solid #eee;">________________________</td></tr><tr><td style="padding:6px 10px; border:1px solid #eee; font-weight:bold; color:#555;">Office Assistant Sign:</td><td style="padding:6px 10px; border:1px solid #eee;">________________________</td></tr></table></div></div></div></div>`;

  const worker = html2pdf().set(opt).from(printDiv).save(opt.filename);
}

async function exportToExcel() {
  const formId = id('applicationsFormFilter')?.value || '';
  try {
    const res = await fetch(`/api/applications?limit=10000&formId=${formId}`);
    const data = await res.json();
    const flattened = data.applications.map(app => ({
      ID: app.id,
      Serial: app.serial_no,
      Form: app.form_name,
      Status: app.status,
      SubmittedAt: app.submitted_at,
      ...app.form_data
    }));
    const worksheet = XLSX.utils.json_to_sheet(flattened);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");
    XLSX.writeFile(workbook, `MCC_Admissions_Report_${new Date().getTime()}.xlsx`);
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
function handleLogout() { fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login.html'); }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ── FIELD MODAL ──
function openFieldModal(fieldId) {
  const modal = id('fieldModal');
  const formId = id('builderFormSelector')?.value;
  if (!modal || !formId) { showToast('Please select a form first'); return; }

  // Reset form
  ['fld_id', 'fld_name', 'fld_label', 'fld_options'].forEach(x => { if (id(x)) id(x).value = ''; });
  if (id('fld_active')) id('fld_active').value = '1';
  if (id('fld_step')) id('fld_step').value = '1';
  if (id('fld_type')) id('fld_type').value = 'text';
  if (id('fld_width')) id('fld_width').value = '6';
  id('fld_required') && (id('fld_required').checked = true);
  id('row_field_name') && (id('row_field_name').style.display = 'block');
  if (id('fld_order')) id('fld_order').value = '99';
  id('row_options') && (id('row_options').style.display = 'none');
  id('fieldModalTitle').textContent = fieldId ? 'Edit Field' : 'Add New Field';

  if (fieldId) {
    fetch(`/api/form-fields/${fieldId}`).then(r => r.json()).then(f => {
      id('fld_id').value = f.id;
      id('fld_step').value = f.step;
      if (id('fld_type')) id('fld_type').value = f.field_type;
      id('fld_name').value = f.field_name;
      id('fld_label').value = f.label;
      if (id('fld_options')) id('fld_options').value = f.options || '';
      if (id('fld_width')) id('fld_width').value = f.column_width || 6;
      if (id('fld_required')) id('fld_required').checked = !!f.required;
      if (id('fld_order')) id('fld_order').value = f.sort_order || 99;
      if (id('fld_active')) id('fld_active').value = f.is_active;
      id('row_field_name').style.display = 'none';
      if (f.field_type === 'select') id('row_options') && (id('row_options').style.display = 'block');
      modal.classList.add('active');
    });
  } else {
    modal.classList.add('active');
  }

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
  const formId = id('builderFormSelector')?.value;
  const body = {
    form_id: parseInt(formId),
    step: parseInt(id('fld_step')?.value || '1'),
    field_type: id('fld_type')?.value || 'text',
    field_name: id('fld_name')?.value?.trim(),
    label: id('fld_label')?.value?.trim(),
    placeholder: '',
    required: id('fld_required')?.checked ? 1 : 0,
    options: id('fld_options')?.value?.trim() || null,
    column_width: parseInt(id('fld_width')?.value || '6'),
    sort_order: parseInt(id('fld_order')?.value || '99'),
    is_active: id('fld_active')?.value === '1' ? 1 : 0
  };

  if (!body.label) { showToast('Label is required'); return; }

  try {
    let res;
    if (fid) {
      res = await fetch(`/api/form-fields/${fid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      if (!body.field_name) { showToast('DB Key is required'); return; }
      res = await fetch('/api/form-fields', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    const data = await res.json();
    if (data.success) { showToast(fid ? 'Field updated!' : 'Field added!'); closeFieldModal(); loadFormFields(); }
    else { showToast(data.message || 'Save failed'); }
  } catch (e) { showToast('Error saving field'); }
}

async function deleteField(fid) {
  if (!confirm('Delete this field?')) return;
  try {
    const res = await fetch(`/api/form-fields/${fid}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showToast('Field deleted!'); loadFormFields(); }
  } catch (e) { showToast('Error deleting field'); }
}

async function saveFieldsOrder() {
  const rows = document.querySelectorAll('#fieldsTbody .field-row');
  const order = Array.from(rows).map((row, idx) => ({ id: parseInt(row.dataset.id), sort_order: idx + 1 }));
  try {
    const res = await fetch('/api/form-fields-order', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
    const data = await res.json();
    if (data.success) { showToast('Order saved!'); id('saveOrderBtn').style.display = 'none'; loadFormFields(); }
  } catch (e) { showToast('Error saving order'); }
}

function openFormSettingsModal() {
  const formId = id('builderFormSelector')?.value;
  if (!formId) return showToast('Select a form first');
  const form = forms.find(f => f.id == formId);
  if (!form) return;
  id('edit_form_name').value = form.name;
  id('edit_form_desc').value = form.description || '';
  id('edit_form_subtitle').value = form.subtitle || '';
  id('formSettingsModal').classList.add('active');
}

function closeFormSettingsModal() { id('formSettingsModal').classList.remove('active'); }

async function saveFormSettings() {
  const formId = id('builderFormSelector')?.value;
  const name = id('edit_form_name').value;
  const description = id('edit_form_desc').value;
  const subtitle = id('edit_form_subtitle').value;
  try {
    const res = await fetch(`/api/forms/${formId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, subtitle })
    });
    if (res.ok) {
      showToast('Form updated!');
      closeFormSettingsModal();
      await loadFormsList();
      loadFormFields();
    } else {
      let errorText = 'Unknown Error';
      const rawText = await res.text();
      try {
        const data = JSON.parse(rawText);
        errorText = data.message || res.statusText;
      } catch (e) {
        errorText = `Status ${res.status}: ` + rawText;
      }
      showToast('Error: ' + errorText.substring(0, 100));
      console.error('Server error:', errorText);
    }
  } catch (e) { 
    showToast('Network Error: ' + e.message); 
    console.error(e);
  }
}

async function deleteForm() {
  if (!confirm('This will disable this form. Proceed?')) return;
  const formId = id('builderFormSelector')?.value;
  try {
    const res = await fetch(`/api/forms/${formId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Form deleted!');
      closeFormSettingsModal();
      window.location.reload();
    }
  } catch (e) { showToast('Error deleting form'); }
}

async function createNewForm() {
  const name = prompt("Enter new form name (e.g., Pre-kg to Class V):");
  if (!name) return;
  try {
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'New admission form' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('New form created!');
      await loadFormsList();
      id('builderFormSelector').value = data.id;
      loadFormFields();
    }
  } catch (e) { showToast('Error creating form'); }
}

// ── USER MANAGEMENT ──────────────────────────────────────────────────────────

async function loadUsers() {
  const tbody = id('usersTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Loading users...</td></tr>';
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    
    if (!Array.isArray(users)) {
       tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Error: ${users.message || 'Access Denied'}</td></tr>`;
       return;
    }
    
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No users found.</td></tr>';
      return;
    }
    
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="font-weight:600;">${esc(u.username)}</td>
        <td>${esc(u.name)}</td>
        <td>${esc(u.phone || '—')}</td>
        <td><span class="role-badge">${esc(u.role_name || (u.is_super ? 'Super Admin' : 'None'))}</span></td>
        <td style="color:#64748b; font-size:12px;">${new Date(u.created_at).toLocaleDateString()}</td>
        <td><span class="status-badge ${u.status === 'Activated' ? 'status-activated' : 'status-deactivated'}">${u.status}</span></td>
        <td style="text-align:center;">${u.is_super ? '<i class="fa-solid fa-crown" style="color:#f59e0b;"></i>' : '—'}</td>
        <td style="text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="action-btn" onclick="openUserModal(${u.id})"><i class="fa-solid fa-pen"></i></button>
            ${!u.is_super ? `<button class="action-btn" onclick="deleteUser(${u.id})" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Error loading users.</td></tr>';
  }
}

async function openUserModal(userId = null) {
  const modal = id('userModal');
  if (id('user_id')) id('user_id').value = userId || '';
  if (id('userModalTitle')) id('userModalTitle').textContent = userId ? 'Edit User' : 'Create New User';
  
  const phint = id('pwd_hint');
  if (phint) phint.style.display = userId ? 'inline' : 'none';
  
  // Reset fields
  ['user_first_name', 'user_last_name', 'user_username', 'user_phone', 'user_password', 'user_status', 'user_role'].forEach(fid => {
    const el = id(fid);
    if (el) el.value = (fid === 'user_status' ? 'Activated' : '');
  });
  if (id('user_is_super')) id('user_is_super').checked = false;

  // Load roles for select
  try {
    const res = await fetch('/api/roles');
    const roles = await res.json();
    id('user_role').innerHTML = '<option value="">Select Role</option>' + 
      roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  } catch (e) {}

  if (userId) {
    const res = await fetch('/api/users');
    const users = await res.json();
    const user = users.find(u => u.id == userId);
    if (user) {
      id('user_first_name').value = user.first_name || '';
      id('user_last_name').value = user.last_name || '';
      id('user_username').value = user.username || '';
      id('user_phone').value = user.phone || '';
      id('user_status').value = user.status || 'Activated';
      id('user_role').value = user.role_id || '';
      id('user_is_super').checked = !!user.is_super;
    }
  }
  modal.classList.add('active');
}

function closeUserModal() { id('userModal').classList.remove('active'); }

async function saveUser() {
  const userId = id('user_id').value;
  const body = {
    first_name: id('user_first_name') ? id('user_first_name').value : 'Admin',
    last_name: id('user_last_name') ? id('user_last_name').value : 'User',
    username: id('user_username').value,
    phone: id('user_phone') ? id('user_phone').value : '',
    status: id('user_status') ? id('user_status').value : 'Activated',
    role_id: id('user_role').value || null,
    is_super: id('user_is_super') && id('user_is_super').checked ? 1 : 0,
    name: (id('user_username').value.split('@')[0]) || 'Admin'
  };
  
  const password = id('user_password').value;
  if (password) body.password = password;
  
  if (!body.username || (!userId && !password)) {
    showToast('Username and Password are required for new users');
    return;
  }

  try {
    const url = userId ? `/api/users/${userId}` : '/api/users';
    const res = await fetch(url, {
      method: userId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast('User saved successfully');
      closeUserModal();
      loadUsers();
    } else {
      showToast('Error: ' + data.message);
    }
  } catch (e) { showToast('Network Error'); }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) { showToast('User deleted'); loadUsers(); }
  } catch (e) { showToast('Error deleting user'); }
}

// ── ROLE MANAGEMENT ──────────────────────────────────────────────────────────

const permissionGroups = {
  'Dashboard': ['dashboard:view'],
  'Applications': ['applications:view', 'applications:edit', 'applications:delete'],
  'Manage Forms': ['forms:view', 'forms:edit', 'forms:delete'],
  'Branding / Identity': ['settings:view', 'settings:edit'],
  'User Management': ['users:view', 'users:edit', 'users:delete'],
  'Roles / Permissions': ['roles:view', 'roles:edit', 'roles:delete']
};

async function loadRoles() {
  const tbody = id('rolesTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading roles...</td></tr>';
  try {
    const res = await fetch('/api/roles');
    const roles = await res.json();

    if (!Array.isArray(roles)) {
       tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Error: ${roles.message || 'Access Denied'}</td></tr>`;
       return;
    }

    if (!roles.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No roles found.</td></tr>';
      return;
    }
    tbody.innerHTML = roles.map(r => `
      <tr>
        <td style="font-weight:700; color:#64748b;">#${r.id}</td>
        <td style="font-weight:600; color:#1e293b;">${esc(r.name)}</td>
        <td style="color:#64748b;">${esc(r.description || '—')}</td>
        <td style="color:#64748b; font-size:12px;">${new Date(r.created_at).toLocaleDateString()}</td>
        <td style="text-align:right;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="action-btn" onclick="openRoleModal(${r.id})"><i class="fa-solid fa-shield-halved"></i> Permissions</button>
            <button class="action-btn" onclick="deleteRole(${r.id})" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error loading roles.</td></tr>';
  }
}

function renderPermissionsGrid(activePerms = []) {
  const grid = id('permissionsGrid');
  if (!grid) return;
  
  const groupIcons = {
    'Dashboard': 'fa-chart-pie',
    'Applications': 'fa-users-rectangle',
    'Manage Forms': 'fa-file-lines',
    'Branding / Identity': 'fa-palette',
    'User Management': 'fa-user-gear',
    'Roles / Permissions': 'fa-shield-halved'
  };

  let html = '';
  Object.entries(permissionGroups).forEach(([groupName, perms]) => {
    const iconClass = groupIcons[groupName] || 'fa-folder';
    html += `
      <div class="permission-group">
        <label class="group-title">
          <i class="fa-solid ${iconClass}"></i> ${groupName}
        </label>
        <div class="permission-items">
          ${perms.map(p => `
            <label class="perm-check">
              <input type="checkbox" class="perm-checkbox" name="permissions" value="${p}" ${activePerms.includes(p) ? 'checked' : ''}> 
              <span>${p.split(':')[1].toUpperCase()}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

async function openRoleModal(roleId = null) {
  const modal = id('roleModal');
  id('role_id').value = roleId || '';
  id('roleModalTitle').textContent = roleId ? 'Edit Role Permissions' : 'Create New Role';
  id('role_name').value = '';
  id('role_description').value = '';
  
  let activePerms = [];
  if (roleId) {
    const res = await fetch('/api/roles');
    const roles = await res.json();
    const role = roles.find(r => r.id == roleId);
    if (role) {
      id('role_name').value = role.name;
      id('role_description').value = role.description || '';
      activePerms = role.permissions || [];
    }
  }
  
  renderPermissionsGrid(activePerms);
  modal.classList.add('active');
}

function closeRoleModal() { id('roleModal').classList.remove('active'); }

async function saveRole() {
  const roleId = id('role_id').value;
  const name = id('role_name').value;
  const description = id('role_description').value;
  
  const permissionChecks = document.querySelectorAll('.perm-checkbox:checked');
  const permissions = Array.from(permissionChecks).map(c => c.value);
  
  if (!name) { showToast('Role name is required'); return; }

  const body = { name, description, permissions };
  
  try {
    const url = roleId ? `/api/roles/${roleId}` : '/api/roles';
    const res = await fetch(url, {
      method: roleId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Role saved successfully');
      closeRoleModal();
      loadRoles();
    }
  } catch (e) { showToast('Network Error'); }
}

async function deleteRole(roleId) {
  if (!confirm('Are you sure you want to delete this role?')) return;
  try {
    const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
    if (res.ok) { showToast('Role deleted'); loadRoles(); }
  } catch (e) { showToast('Error deleting role'); }
}



function getBase64ImageFromUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url + "?t=" + new Date().getTime(); // Prevent caching issues
  });
}

