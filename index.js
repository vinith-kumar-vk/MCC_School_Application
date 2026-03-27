const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3105;

// Ensure directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(__dirname, 'public', 'images');
[uploadDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup for Photograph Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// DB Setup
const db = new Database(path.join(__dirname, 'new_concept.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_no TEXT,
    academic_year TEXT,
    photograph_path TEXT,
    pupil_name TEXT NOT NULL,
    admission_class TEXT DEFAULT 'XI',
    dob TEXT,
    gender TEXT,
    blood_group TEXT,
    nationality TEXT,
    religion TEXT,
    caste TEXT,
    community TEXT,
    mother_tongue TEXT,
    id_mark_1 TEXT,
    id_mark_2 TEXT,
    comm_address TEXT,
    contact_no_email TEXT,
    father_name TEXT,
    father_qualification TEXT,
    father_occupation TEXT,
    father_office_address TEXT,
    father_mobile TEXT,
    father_landline TEXT,
    father_income TEXT,
    mother_name TEXT,
    mother_qualification TEXT,
    mother_occupation TEXT,
    mother_office_address TEXT,
    mother_mobile TEXT,
    mother_landline TEXT,
    mother_income TEXT,
    qualifying_exam_name TEXT,
    qualifying_exam_year TEXT,
    medium_of_instruction TEXT,
    last_school_details TEXT,
    emis_no TEXT,
    aadhaar_no TEXT,
    tc_mark_attached TEXT,
    marks_lang_val TEXT,
    marks_eng_val TEXT,
    marks_math_val TEXT,
    marks_sci_val TEXT,
    marks_soc_val TEXT,
    marks_grand_total TEXT,
    first_language TEXT,
    second_language TEXT DEFAULT 'English',
    group_choice TEXT,
    credentials TEXT,
    status TEXT DEFAULT 'Pending',
    declaration_agreed INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS form_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step INTEGER NOT NULL DEFAULT 1,
    field_type TEXT NOT NULL,
    field_name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    placeholder TEXT,
    required INTEGER DEFAULT 1,
    options TEXT,
    sort_order INTEGER DEFAULT 0,
    column_width INTEGER DEFAULT 6,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default site settings
const defaultSettings = [
  { key: 'site_title', value: 'MCC CAMPUS MATRICULATION HIGHER SECONDARY SCHOOL' },
  { key: 'site_subtitle', value: '#1, Air Force Road, East Tambaram, Chennai - 600059' },
  { key: 'site_contact', value: 'Ph : 044-2239 1620 | E-mail : mcccampus.school91@gmail.com' },
  { key: 'form_title', value: 'APPLICATION FOR ADMISSION (CLASS XI and XII)' },
  { key: 'form_subtitle', value: 'Please refer to the physical form and fill all mandatory fields exactly.' },
  { key: 'logo_path', value: '/images/logo.png' },
  { key: 'footer_text', value: '© 2026 MCC Campus Matriculation Higher Secondary School' }
];
const insertSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

// Seed default form fields ONLY if table is empty (no wipe on restart)
try {
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM form_fields').get().c;
  if (existingCount === 0) {
    const insertField = db.prepare(`INSERT OR IGNORE INTO form_fields (step, field_type, field_name, label, placeholder, required, options, sort_order, column_width) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const defaultFields = [
      // Step 1: Applicant's Information
      [1, 'text', 'pupil_name', '1. Name of the Pupil ( Block Letters )', 'Pupil name here', 1, null, 3, 12],
      [1, 'text', 'admission_class', '2. Class of Admission', 'XI', 1, null, 4, 6],
      [1, 'date', 'dob', '3. Date of Birth ( Date / Month / Year )', '', 1, null, 5, 6],
      [1, 'select', 'gender', '4. Gender ( Female/ Male )', '', 1, 'Male,Female', 6, 4],
      [1, 'text', 'blood_group', '5. Blood Group', '', 1, null, 7, 4],
      [1, 'text', 'nationality', '6. Nationality', 'Indian', 1, null, 8, 4],
      [1, 'text', 'religion', '7. Religion', '', 1, null, 9, 6],
      [1, 'text', 'caste', '8. a. Caste (For statistical purpose only)', '', 0, null, 10, 6],
      [1, 'select', 'community', '8. b. Community (BC/MBC/SC/ST/Denotified Community)', 'Select', 1, 'BC,MBC,SC,ST,Denotified Community', 11, 6],
      [1, 'text', 'mother_tongue', '8. c. Mother Tongue', '', 1, null, 12, 6],
      [1, 'text', 'id_mark_1', '9. Identification Marks: (1)', '', 1, null, 13, 12],
      [1, 'text', 'id_mark_2', '(2)', '', 1, null, 14, 12],

      // Step 2: Contact & Parents Information
      [2, 'textarea', 'comm_address', '10. Address for Communication', '', 1, null, 1, 12],
      [2, 'text', 'contact_no_email', '11. Contact No. & Email ID', '', 1, null, 2, 12],
      [2, 'text', 'father_name', '12. a. Father Name (Block Letters)', '', 1, null, 3, 6],
      [2, 'text', 'mother_name', '12. a. Mother Name (Block Letters)', '', 1, null, 4, 6],
      [2, 'text', 'father_qualification', '12. b. Educational qualification (Father)', '', 1, null, 5, 6],
      [2, 'text', 'mother_qualification', '12. b. Educational qualification (Mother)', '', 1, null, 6, 6],
      [2, 'text', 'father_occupation', '12. c. Occupation (Father)', '', 1, null, 7, 6],
      [2, 'text', 'mother_occupation', '12. c. Occupation (Mother)', '', 1, null, 8, 6],
      [2, 'textarea', 'father_office_address', '12. d. Address of the office/business (Father)', '', 1, null, 9, 6],
      [2, 'textarea', 'mother_office_address', '12. d. Address of the office/business (Mother)', '', 1, null, 10, 6],
      [2, 'tel', 'father_mobile', '12. e. Mobile No. (Father)', '', 1, null, 11, 6],
      [2, 'tel', 'mother_mobile', '12. e. Mobile No. (Mother)', '', 1, null, 12, 6],
      [2, 'tel', 'father_landline', '12. f. Landline No. (Father)', '', 0, null, 13, 6],
      [2, 'tel', 'mother_landline', '12. f. Landline No. (Mother)', '', 0, null, 14, 6],
      [2, 'text', 'father_income', '12. g. Monthly Income (Father)', '', 1, null, 15, 6],
      [2, 'text', 'mother_income', '12. g. Monthly Income (Mother)', '', 1, null, 16, 6],

      // Step 3: Academics & Group Offered
      [3, 'text', 'qualifying_exam_name', '13. Qualifying examination passed ( SSLC/CBSE/ICSE )', '', 1, null, 1, 6],
      [3, 'text', 'qualifying_exam_year', '& Year', '', 1, null, 2, 6],
      [3, 'text', 'medium_of_instruction', '14. Medium of instruction studied at school', 'English', 1, null, 3, 12],
      [3, 'text', 'last_school_details', '15. Name and address of the school last studied', '', 1, null, 4, 12],
      [3, 'text', 'emis_no', '16. EMIS No.', '', 0, null, 5, 6],
      [3, 'text', 'aadhaar_no', '17. Aadhaar No.', '', 1, null, 6, 6],
      [3, 'select', 'tc_mark_attached', '18. Whether copies of T.C and Mark Certificate(s) are attached?', '', 1, 'Yes,No', 7, 12],
      [3, 'select', 'first_language', '19. Part I: First Language (Tamil / French / German)', '', 1, 'Tamil,French,German', 8, 6],
      [3, 'select', 'group_choice', '19. Part III: Group you are seeking admission for:', 'Select', 1, 'Phy/Che/Bio/Mat (Science),Phy/Che/Mat/CS (Science),Phy/Che/Bio/CS (Science),Phy/Che/Bio/Comm.Eng (Science),Com/Acc/Eco/CA (Commerce),Com/Acc/Eco/Bus.Mat (Commerce),His/Geo/Eco/Pol.Sci (Humanities)', 9, 12],

      // Step 4: Marks Table
      [4, 'number', 'marks_lang_val', 'Language', '100', 1, null, 1, 4],
      [4, 'number', 'marks_eng_val', 'English', '100', 1, null, 2, 4],
      [4, 'number', 'marks_math_val', 'Mathematics', '100', 1, null, 3, 4],
      [4, 'number', 'marks_sci_val', 'Science', '100', 1, null, 4, 4],
      [4, 'number', 'marks_soc_val', 'Social Science', '100', 1, null, 5, 4],
      [4, 'number', 'marks_grand_total', 'Total', '500', 1, null, 6, 12],
      [4, 'textarea', 'credentials', '20. Proficiency in Sports / Extracurricular activities / Music', '', 0, null, 7, 12]
    ];
    defaultFields.forEach(f => insertField.run(...f));
  }
} catch (e) { console.error('Seeding error:', e); }


// Seed default admin
const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('mccmrfadmin');
if (!adminExists) {
  const hashed = bcrypt.hashSync('admin1234', 10);
  db.prepare('INSERT INTO admins (username, password, name) VALUES (?, ?, ?)').run('mccmrfadmin', hashed, 'MCC Admin');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'mcc-school-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const requireAuth = (req, res, next) => {
  if (req.session && req.session.adminId) return next();
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.post('/api/apply', upload.single('photograph'), (req, res) => {
  try {
    const data = req.body;
    const photograph_path = req.file ? '/uploads/' + req.file.filename : null;

    // Dynamic column mapping
    const columns = Object.keys(data).filter(k => k !== 'declaration_agreed');
    const values = columns.map(k => data[k]);

    columns.push('photograph_path');
    values.push(photograph_path);
    columns.push('declaration_agreed');
    values.push(data.declaration_agreed ? 1 : 0);

    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO applications (${columns.join(', ')}) VALUES (${placeholders})`;
    db.prepare(query).run(...values);

    res.json({ success: true, message: 'Application submitted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// Other APIs remain same
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }
  req.session.adminId = admin.id;
  req.session.adminName = admin.name;
  res.json({ success: true, name: admin.name });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
  if (req.session && req.session.adminId) {
    res.json({ authenticated: true, name: req.session.adminName });
  } else {
    res.json({ authenticated: false });
  }
});

app.get('/api/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
  const science = db.prepare("SELECT COUNT(*) as count FROM applications WHERE group_choice LIKE '%Science%' OR group_choice LIKE '%Phy%'").get().count;
  const commerce = db.prepare("SELECT COUNT(*) as count FROM applications WHERE group_choice LIKE '%Commerce%' OR group_choice LIKE '%Com/%'").get().count;
  res.json({ total, science, commerce, others: total - science - commerce });
});

app.get('/api/applications', requireAuth, (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (pupil_name LIKE ? OR group_choice LIKE ? OR aadhaar_no LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const totalCount = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count')).get(...params).count;
  query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const apps = db.prepare(query).all(...params);
  res.json({ applications: apps, total: totalCount, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/api/applications/:id', requireAuth, (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: 'Not found' });
  res.json(app);
});

app.patch('/api/applications/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  try {
    db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.get('/api/form-fields', (req, res) => {
  const fields = db.prepare('SELECT * FROM form_fields WHERE is_active = 1 ORDER BY step ASC, sort_order ASC').all();
  res.json(fields);
});

// Get single field
app.get('/api/form-fields/:id', requireAuth, (req, res) => {
  const field = db.prepare('SELECT * FROM form_fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ success: false, message: 'Field not found' });
  res.json(field);
});

// Create new field
app.post('/api/form-fields', requireAuth, (req, res) => {
  try {
    const { step, field_type, field_name, label, placeholder, required, options, sort_order, column_width } = req.body;
    const maxOrder = db.prepare('SELECT MAX(sort_order) as mo FROM form_fields WHERE step = ?').get(step);
    const nextOrder = (maxOrder.mo || 0) + 1;
    const result = db.prepare(
      'INSERT INTO form_fields (step, field_type, field_name, label, placeholder, required, options, sort_order, column_width) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(step, field_type, field_name, label, placeholder || '', required ? 1 : 0, options || null, sort_order || nextOrder, column_width || 6);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, message: e.message });
  }
});

// Update field
app.put('/api/form-fields/:id', requireAuth, (req, res) => {
  try {
    const { step, field_type, label, placeholder, required, options, sort_order, column_width } = req.body;
    db.prepare(
      'UPDATE form_fields SET step=?, field_type=?, label=?, placeholder=?, required=?, options=?, sort_order=?, column_width=? WHERE id=?'
    ).run(step, field_type, label, placeholder || '', required ? 1 : 0, options || null, sort_order, column_width || 6, req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, message: e.message });
  }
});

// Delete field
app.delete('/api/form-fields/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM form_fields WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Reorder fields
app.put('/api/form-fields-order', requireAuth, (req, res) => {
  try {
    const { order } = req.body; // array of { id, sort_order }
    const stmt = db.prepare('UPDATE form_fields SET sort_order = ? WHERE id = ?');
    const updateMany = db.transaction((items) => {
      for (const item of items) stmt.run(item.sort_order, item.id);
    });
    updateMany(order);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Update site settings
app.put('/api/settings', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
    const updateAll = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) stmt.run(key, value);
    });
    updateAll(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MCC School System Successfully Running on port: ${PORT}`);
});
