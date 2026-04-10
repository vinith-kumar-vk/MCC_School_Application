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
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT, -- JSON string of permission keys
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Activated',
    role_id INTEGER,
    is_super INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    subtitle TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    serial_no TEXT,
    photograph_path TEXT,
    form_data TEXT NOT NULL, -- JSON string
    status TEXT DEFAULT 'Pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id)
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS form_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL DEFAULT 1,
    step INTEGER NOT NULL DEFAULT 1,
    field_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    label TEXT NOT NULL,
    placeholder TEXT,
    required INTEGER DEFAULT 1,
    options TEXT,
    sort_order INTEGER DEFAULT 0,
    column_width INTEGER DEFAULT 6,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id)
  );
`);

try {
  db.prepare('ALTER TABLE forms ADD COLUMN subtitle TEXT').run();
} catch (e) {
  // column might already exist, ignore
}

// Seed default site settings
const defaultSettings = [
  { key: 'site_title', value: 'MCC CAMPUS MATRICULATION HIGHER SECONDARY SCHOOL' },
  { key: 'site_subtitle', value: 'MATRICULATION SCHOOL' },
  { key: 'site_location', value: '#1, Air Force Road, East Tambaram, Chennai - 600059' },
  { key: 'site_contact', value: '044-2239 1620 | mcccampus.school91@gmail.com' },
  { key: 'form_title', value: 'APPLICATION FOR ADMISSION (CLASS XI to XII)' },
  { key: 'form1_title', value: 'APPLICATION FOR ADMISSION (Pre-kg to X)' },
  { key: 'form2_title', value: 'APPLICATION FOR ADMISSION (CLASS XI to XII)' },
  { key: 'form_subtitle', value: 'MCC Campus Matriculation Higher Secondary School traces its root as Campus Primary School in the premises of MCC in 1985. It is recognized by the Government of Tamil Nadu Matriculation Board of Education.' },
  { key: 'logo_path', value: '/images/logo.png' },
  { key: 'landing_title', value: 'MCC CAMPUS Matriculation Higher Secondary School' },
  { key: 'footer_text', value: 'Copyright © 2024 MCC– Campus Matriculation Higher Secondary School' },
  { key: 'btn1_label', value: 'Pre-kg to CLASS X ADMISSION' },
  { key: 'btn2_label', value: 'CLASS XI & XII ADMISSION' },
  { key: 'admission_year', value: '2026 - 2031' }  // Admission cycle used in serial no. & form header
];


// INSERT OR IGNORE: only set defaults for keys that don't already exist.
// This prevents server restarts (nodemon) from wiping user-saved settings.
const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

// Seed default forms
try {
  const formCount = db.prepare('SELECT COUNT(*) as c FROM forms').get().c;
  if (formCount === 0) {
    db.prepare('INSERT INTO forms (name, subtitle, description) VALUES (?, ?, ?)').run('APPLICATION FOR ADMISSION (CLASS Pre-kg to X)', 'Pre-kg to X ADMISSION FORM', 'Pre-kg to X Admission Form');
    db.prepare('INSERT INTO forms (name, subtitle, description) VALUES (?, ?, ?)').run('APPLICATION FOR ADMISSION (CLASS XI to XII)', 'XI to XII ADMISSION FORM', 'XI and XII Admission Form');
  } else {
    // Migrate old names
    db.prepare("UPDATE forms SET name = 'APPLICATION FOR ADMISSION (CLASS Pre-kg to X)' WHERE name LIKE '%LKG to X%'").run();
    db.prepare("UPDATE forms SET name = 'APPLICATION FOR ADMISSION (CLASS Pre-kg to X)' WHERE name LIKE '%Lkg to X%'").run();
    // Migrate old subtitles
    db.prepare("UPDATE forms SET subtitle = 'Pre-kg to X ADMISSION FORM' WHERE id = 1 AND (subtitle IS NULL OR subtitle LIKE '%LKG%' OR subtitle LIKE '%Lkg%')").run();
    db.prepare("UPDATE forms SET subtitle = 'XI to XII ADMISSION FORM' WHERE id = 2 AND (subtitle IS NULL OR subtitle = '')").run();
  }
} catch (e) { console.error('Form seeding error:', e); }


// Seed default form fields ONLY if table is empty (no wipe on restart)
try {
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM form_fields').get().c;
  if (existingCount === 0) {
    const insertField = db.prepare(`INSERT OR IGNORE INTO form_fields (form_id, step, field_type, field_name, label, placeholder, required, options, sort_order, column_width) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    // Form 2 (XI & XII) Fields
    const xiFields = [
      [2, 1, 'text', 'pupil_name', '1. Name of the Pupil ( Block Letters )', 'Pupil name here', 1, null, 3, 12],
      [2, 1, 'text', 'admission_class', '2. Class of Admission', 'XI', 1, null, 4, 6],
      [2, 1, 'date', 'dob', '3. Date of Birth ( Date / Month / Year )', '', 1, null, 5, 6],
      [2, 1, 'select', 'gender', '4. Gender ( Female/ Male )', '', 1, 'Male,Female', 6, 4],
      [2, 1, 'text', 'blood_group', '5. Blood Group', '', 1, null, 7, 4],
      [2, 1, 'text', 'nationality', '6. Nationality', 'Indian', 1, null, 8, 4],
      [2, 1, 'text', 'religion', '7. Religion', '', 1, null, 9, 6],
      [2, 1, 'text', 'caste', '8. a. Caste (For statistical purpose only)', '', 0, null, 10, 6],
      [2, 1, 'select', 'community', '8. b. Community (BC/MBC/SC/ST/Denotified Community)', 'Select', 1, 'BC,MBC,SC,ST,Denotified Community', 11, 6],
      [2, 1, 'text', 'mother_tongue', '8. c. Mother Tongue', '', 1, null, 12, 6],
      [2, 1, 'text', 'id_mark_1', '9. Identification Marks: (1)', '', 1, null, 13, 12],
      [2, 1, 'text', 'id_mark_2', '(2)', '', 1, null, 14, 12],
      [2, 2, 'textarea', 'comm_address', '10. Address for Communication', '', 1, null, 1, 12],
      [2, 2, 'text', 'contact_no_email', '11. Contact No. & Email ID', '', 1, null, 2, 12],
      [2, 2, 'text', 'father_name', '12. a. Father Name (Block Letters)', '', 1, null, 3, 6],
      [2, 2, 'text', 'mother_name', '12. a. Mother Name (Block Letters)', '', 1, null, 4, 6],
      [2, 2, 'text', 'father_qualification', '12. b. Educational qualification (Father)', '', 1, null, 5, 6],
      [2, 2, 'text', 'mother_qualification', '12. b. Educational qualification (Mother)', '', 1, null, 6, 6],
      [2, 2, 'text', 'father_occupation', '12. c. Occupation (Father)', '', 1, null, 7, 6],
      [2, 2, 'text', 'mother_occupation', '12. c. Occupation (Mother)', '', 1, null, 8, 6],
      [2, 2, 'textarea', 'father_office_address', '12. d. Address of the office/business (Father)', '', 1, null, 9, 6],
      [2, 2, 'textarea', 'mother_office_address', '12. d. Address of the office/business (Mother)', '', 1, null, 10, 6],
      [2, 2, 'tel', 'father_mobile', '12. e. Mobile No. (Father)', '', 1, null, 11, 6],
      [2, 2, 'tel', 'mother_mobile', '12. e. Mobile No. (Mother)', '', 1, null, 12, 6],
      [2, 2, 'tel', 'father_landline', '12. f. Landline No. (Father)', '', 0, null, 13, 6],
      [2, 2, 'tel', 'mother_landline', '12. f. Landline No. (Mother)', '', 0, null, 14, 6],
      [2, 2, 'text', 'father_income', '12. g. Monthly Income (Father)', '', 1, null, 15, 6],
      [2, 2, 'text', 'mother_income', '12. g. Monthly Income (Mother)', '', 1, null, 16, 6],
      [2, 3, 'text', 'qualifying_exam_name', '13. Qualifying examination passed ( SSLC/CBSE/ICSE )', '', 1, null, 1, 6],
      [2, 3, 'text', 'qualifying_exam_year', '& Year', '', 1, null, 2, 6],
      [2, 3, 'text', 'medium_of_instruction', '14. Medium of instruction studied at school', 'English', 1, null, 3, 12],
      [2, 3, 'text', 'last_school_details', '15. Name and address of the school last studied', '', 1, null, 4, 12],
      [2, 3, 'text', 'emis_no', '16. EMIS No.', '', 0, null, 5, 6],
      [2, 3, 'text', 'aadhaar_no', '17. Aadhaar No.', '', 1, null, 6, 6],
      [2, 3, 'select', 'tc_mark_attached', '18. Whether copies of T.C and Mark Certificate(s) are attached?', '', 1, 'Yes,No', 7, 12],
      [2, 3, 'select', 'first_language', '19. Part I: First Language (Tamil / French / German)', '', 1, 'Tamil,French,German', 8, 6],
      [2, 3, 'select', 'group_choice', '19. Part III: Group you are seeking admission for:', 'Select', 1, 'Phy/Che/Bio/Mat (Science),Phy/Che/Mat/CS (Science),Phy/Che/Bio/CS (Science),Phy/Che/Bio/Comm.Eng (Science),Com/Acc/Eco/CA (Commerce),Com/Acc/Eco/Bus.Mat (Commerce),His/Geo/Eco/Pol.Sci (Humanities)', 9, 12],
      [2, 4, 'number', 'marks_lang_val', 'Language', '100', 1, null, 1, 4],
      [2, 4, 'number', 'marks_eng_val', 'English', '100', 1, null, 2, 4],
      [2, 4, 'number', 'marks_math_val', 'Mathematics', '100', 1, null, 3, 4],
      [2, 4, 'number', 'marks_sci_val', 'Science', '100', 1, null, 4, 4],
      [2, 4, 'number', 'marks_soc_val', 'Social Science', '100', 1, null, 5, 4],
      [2, 4, 'number', 'marks_grand_total', 'Total', '500', 1, null, 6, 12],
      [2, 4, 'textarea', 'credentials', '20. Proficiency in Sports / Extracurricular activities / Music', '', 0, null, 7, 12]
    ];
    // Form 1 (LKG - X) Fields
    const lkgFields = [
      // Step 1: Pupil's Details
      [1, 1, 'text', 'class_registered', '1. Class Registered for', 'e.g. LKG', 1, null, 1, 6],
      [1, 1, 'text', 'pupil_name', '2. Name of the Pupil in English (BLOCK LETTERS)', 'Full Name', 1, null, 2, 12],
      [1, 1, 'text', 'pupil_name_tamil', '3. Name of the Pupil in Tamil', 'தமிழில் பெயர்', 1, null, 3, 12],
      [1, 1, 'date', 'dob', '4. Date of Birth', '', 1, null, 4, 6],
      [1, 1, 'select', 'gender', '5. Gender', '', 1, 'Male,Female', 5, 3],
      [1, 1, 'text', 'blood_group', '6. Blood Group', '', 1, null, 6, 3],
      [1, 1, 'text', 'nationality', '7. Nationality', 'Indian', 1, null, 7, 6],
      [1, 1, 'text', 'religion', '8. Religion', '', 1, null, 8, 6],
      [1, 1, 'text', 'caste', '9. a. Caste (For statistical purpose only)', '', 0, null, 9, 6],
      [1, 1, 'select', 'community', '9. b. Community', 'Select', 1, 'OC,BC,MBC,SC,ST,Denotified Community', 10, 6],
      [1, 1, 'text', 'aadhaar_no', '9. c. Aadhaar Card No.', '', 1, null, 11, 12],

      // Step 2: Communication & Parents Info
      [1, 2, 'textarea', 'comm_address', '10. Address for Communication', '', 1, null, 1, 12],
      [1, 2, 'text', 'contact_no_email', '11. Contact No. & Email ID', '', 1, null, 2, 12],
      [1, 2, 'text', 'mother_tongue', '11. a. Mother Tongue', '', 1, null, 3, 6],
      [1, 2, 'text', 'other_languages', '11. b. Any other language known to the Pupil', '', 0, null, 4, 6],
      [1, 2, 'text', 'father_name', '12. a. Father Name', '', 1, null, 5, 6],
      [1, 2, 'text', 'mother_name', '12. a. Mother Name', '', 1, null, 6, 6],
      [1, 2, 'date', 'father_dob', '12. b. Date of Birth (Father)', '', 1, null, 7, 6],
      [1, 2, 'date', 'mother_dob', '12. b. Date of Birth (Mother)', '', 1, null, 8, 6],
      [1, 2, 'text', 'father_edu', '12. c. Educational Qualification (Father)', '', 1, null, 9, 6],
      [1, 2, 'text', 'mother_edu', '12. c. Educational Qualification (Mother)', '', 1, null, 10, 6],
      [1, 2, 'text', 'father_occ', '12. d. Occupation (Father)', '', 1, null, 11, 6],
      [1, 2, 'text', 'mother_occ', '12. d. Occupation (Mother)', '', 1, null, 12, 6],
      [1, 2, 'textarea', 'father_office', '12. e. Name of the Office & Address (Father)', '', 1, null, 13, 6],
      [1, 2, 'textarea', 'mother_office', '12. e. Name of the Office & Address (Mother)', '', 1, null, 14, 6],
      [1, 2, 'text', 'father_mobile', '12. f. Mobile & Land Line No. (Father)', '', 1, null, 15, 6],
      [1, 2, 'text', 'mother_mobile', '12. f. Mobile & Land Line No. (Mother)', '', 1, null, 16, 6],
      [1, 2, 'text', 'father_income', '12. g. Monthly Income (Father)', '', 1, null, 17, 6],
      [1, 2, 'text', 'mother_income', '12. g. Monthly Income (Mother)', '', 1, null, 18, 6],
      [1, 2, 'text', 'father_aadhaar', '12. h. Aadhaar Card No. (Father)', '', 1, null, 19, 6],
      [1, 2, 'text', 'mother_aadhaar', '12. h. Aadhaar Card No. (Mother)', '', 1, null, 20, 6],

      // Step 3: Schooling & Connections
      [1, 3, 'text', 'mcc_staff_details', '12. h. If Staff at MCC (Dept/Unit/School)', 'Details if applicable', 0, null, 1, 12],
      [1, 3, 'text', 'alumni_details', '12. i. If Alumni of Campus School (Name & Year)', 'Details if applicable', 0, null, 2, 12],
      [1, 3, 'text', 'sibling_details', '12. j. If sibling studying in Campus School (Name & Std)', 'Details if applicable', 0, null, 3, 12],
      [1, 3, 'text', 'prev_school', '13. Mention the name of the School studied earlier', '', 0, null, 4, 12],
      [1, 3, 'text', 'prev_class', '13. a. Class', '', 0, null, 5, 4],
      [1, 3, 'text', 'prev_year', '13. b. Year', '', 0, null, 6, 4],
      [1, 3, 'text', 'emis_no', '13. c. EMIS No.', '', 0, null, 7, 4],

      // Step 4: Health & Identity
      [1, 4, 'text', 'id_mark_1', '14. Identification marks (1)', '', 1, null, 1, 12],
      [1, 4, 'text', 'id_mark_2', '(2)', '', 1, null, 2, 12],
      [1, 4, 'textarea', 'medical_history', '15. Previous Medical History (eg. Asthma, Allergies, Fits, Surgery, etc.)', '', 0, null, 3, 12]
    ];

    [...xiFields, ...lkgFields].forEach(f => insertField.run(...f));
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

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.session || !req.session.adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (req.session.isSuper) return next();
    if (req.session.permissions && req.session.permissions.includes(permission)) return next();
    res.status(403).json({ success: false, message: 'Forbidden: Missing permission ' + permission });
  };
};

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.post('/api/apply', upload.single('photograph'), (req, res) => {
  try {
    const { form_id, ...formData } = req.body;
    const photograph_path = req.file ? '/uploads/' + req.file.filename : null;

    // ── Generate Unique Application Serial Number ──
    const cycleRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('admission_year');
    const curYear = new Date().getFullYear();
    const admissionCycle = (cycleRow && cycleRow.value) ? cycleRow.value : `${curYear} - ${curYear + 5}`;
    const startYear = admissionCycle.match(/\d{4}/)?.[0] || curYear;
    const countResult = db.prepare('SELECT COUNT(*) as count FROM applications').get();
    const nextId = (countResult.count || 0) + 1;
    const serialNo = `MCC/${startYear}/${nextId.toString().padStart(4, '0')}`;

    db.prepare('INSERT INTO applications (form_id, serial_no, form_data, photograph_path) VALUES (?, ?, ?, ?)')
      .run(form_id, serialNo, JSON.stringify(formData), photograph_path);

    res.json({ 
      success: true, 
      message: 'Application submitted successfully!', 
      serialNo: serialNo 
    });
  } catch (err) {
    console.error('Submission Error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

app.get('/api/next-serial', (req, res) => {
  try {
    const cycleRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('admission_year');
    const curYear = new Date().getFullYear();
    const admissionCycle = (cycleRow && cycleRow.value) ? cycleRow.value : `${curYear} - ${curYear + 5}`;
    const startYear = admissionCycle.match(/\d{4}/)?.[0] || curYear;
    const countResult = db.prepare('SELECT COUNT(*) as count FROM applications').get();
    const nextId = (countResult.count || 0) + 1;
    const serialNo = `MCC/${startYear}/${nextId.toString().padStart(4, '0')}`;
    res.json({ success: true, serialNo });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Specialized storage for logo (always public/images/logo.png)
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => cb(null, 'logo.png')
});
const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/upload-logo', requireAuth, (req, res, next) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: 'File too large (Max 5MB)' });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const logoPath = '/images/logo.png';
      db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run('logo_path', logoPath);
      res.json({ success: true, logoPath });
    } catch (dbErr) {
      res.status(500).json({ success: false, message: dbErr.message });
    }
  });
});





// Other APIs remain same
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare(`
    SELECT a.*, r.name as role_name, r.permissions 
    FROM admins a 
    LEFT JOIN roles r ON a.role_id = r.id 
    WHERE a.username = ?
  `).get(username);

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }

  if (admin.status !== 'Activated') {
    return res.json({ success: false, message: 'Account is deactivated' });
  }

  req.session.adminId = admin.id;
  req.session.adminName = admin.name;
  req.session.adminUsername = admin.username;
  req.session.isSuper = (admin.is_super === 1 || admin.username === 'mccmrfadmin');
  req.session.roleName = req.session.isSuper ? 'Super Admin' : (admin.role_name || 'Admin');
  // Wildcard for Super Admin
  req.session.permissions = req.session.isSuper ? ['*'] : (admin.permissions ? JSON.parse(admin.permissions) : []);
  
  res.json({ 
    success: true, 
    name: admin.name, 
    isSuper: !!admin.is_super,
    roleName: req.session.roleName,
    permissions: req.session.permissions 
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
  if (!req.session || !req.session.adminId) return res.json({ authenticated: false });
  
  // Re-verify from DB for reliable permission state
  const admin = db.prepare(`
    SELECT a.*, r.name as role_name, r.permissions 
    FROM admins a 
    LEFT JOIN roles r ON a.role_id = r.id 
    WHERE a.id = ?
  `).get(req.session.adminId);

  if (!admin) return res.json({ authenticated: false });

  const isSuper = (admin.is_super === 1 || admin.username === 'mccmrfadmin');
  
  res.json({ 
    authenticated: true, 
    name: admin.name,
    username: admin.username,
    isSuper: isSuper,
    roleName: isSuper ? 'Super Admin' : (admin.role_name || 'Administrator'),
    permissions: isSuper ? ['*'] : (admin.permissions ? JSON.parse(admin.permissions) : [])
  });
});

app.get('/api/stats', requireAuth, (req, res) => {
  const { formId } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (formId) {
    where += ' AND form_id = ?';
    params.push(formId);
  }
  const total = db.prepare(`SELECT COUNT(*) as count FROM applications ${where}`).get(...params).count;
  // Generic stats for now, can be customized per form later
  res.json({ total, forms: db.prepare('SELECT id, name FROM forms').all() });
});

app.get('/api/applications', requireAuth, (req, res) => {
  const { search, formId, page = 1, limit = 10 } = req.query;
  let query = 'SELECT a.*, f.name as form_name FROM applications a JOIN forms f ON a.form_id = f.id WHERE 1=1';
  const params = [];
  if (formId) {
    query += ' AND a.form_id = ?';
    params.push(formId);
  }
  if (search) {
    query += ' AND (a.form_data LIKE ? OR a.serial_no LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  const totalCount = db.prepare(`SELECT COUNT(*) as count FROM (${query})`).get(...params).count;
  query += ' ORDER BY a.id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const apps = db.prepare(query).all(...params);

  // Parse JSON data for frontend ease
  const processedApps = apps.map(app => ({
    ...app,
    form_data: JSON.parse(app.form_data)
  }));

  res.json({ applications: processedApps, total: totalCount, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/api/applications/:id', requireAuth, (req, res) => {
  const app = db.prepare('SELECT a.*, f.name as form_name FROM applications a JOIN forms f ON a.form_id = f.id WHERE a.id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: 'Not found' });
  app.form_data = JSON.parse(app.form_data);
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

app.patch('/api/applications/:id/serial', requireAuth, (req, res) => {
  const { serial } = req.body;
  try {
    db.prepare('UPDATE applications SET serial_no = ? WHERE id = ?').run(serial, req.params.id);
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

app.get('/api/forms', (req, res) => {
  const forms = db.prepare('SELECT * FROM forms WHERE is_active = 1').all();
  res.json(forms);
});

app.post('/api/forms', requireAuth, (req, res) => {
  const { name, description, subtitle } = req.body;
  const result = db.prepare('INSERT INTO forms (name, description, subtitle) VALUES (?, ?, ?)').run(name, description || '', subtitle || '');
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/forms/:id', requireAuth, (req, res) => {
  try {
    const { name, description, subtitle } = req.body;
    db.prepare('UPDATE forms SET name=?, description=?, subtitle=? WHERE id=?').run(name, description, subtitle || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving form:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/forms/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE forms SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/form-fields', (req, res) => {
  const { formId, admin } = req.query;
  if (!formId) return res.status(400).json({ error: 'formId is required' });
  
  let query = 'SELECT * FROM form_fields WHERE form_id = ?';
  if (admin !== 'true') {
    query += ' AND is_active = 1';
  }
  query += ' ORDER BY step ASC, sort_order ASC';
  
  const fields = db.prepare(query).all(formId);
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
    const { form_id, step, field_type, field_name, label, placeholder, required, options, sort_order, column_width } = req.body;
    if (!form_id) return res.status(400).json({ success: false, message: 'form_id is required' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as mo FROM form_fields WHERE form_id = ? AND step = ?').get(form_id, step);
    const nextOrder = (maxOrder.mo || 0) + 1;
    const result = db.prepare(
      'INSERT INTO form_fields (form_id, step, field_type, field_name, label, placeholder, required, options, sort_order, column_width) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(form_id, step, field_type, field_name, label, placeholder || '', required ? 1 : 0, options || null, sort_order || nextOrder, column_width || 6);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, message: e.message });
  }
});

// Update field
app.put('/api/form-fields/:id', requireAuth, (req, res) => {
  try {
    const { step, field_type, label, placeholder, required, options, sort_order, column_width, form_id, is_active } = req.body;
    db.prepare(
      'UPDATE form_fields SET step=?, field_type=?, label=?, placeholder=?, required=?, options=?, sort_order=?, column_width=?, form_id=?, is_active=? WHERE id=?'
    ).run(step, field_type, label, placeholder || '', required ? 1 : 0, options || null, sort_order, column_width || 6, form_id, is_active === undefined ? 1 : is_active, req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, message: e.message });
  }
});

// Toggle field active status
app.patch('/api/form-fields/:id/toggle', requireAuth, (req, res) => {
  try {
    const { is_active } = req.body;
    db.prepare('UPDATE form_fields SET is_active = ? WHERE id = ?').run(is_active, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
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

// ── USER MANAGEMENT ──────────────────────────────────────────────────────────

app.get('/api/users', requirePermission('users:view'), (req, res) => {
  const users = db.prepare(`
    SELECT a.id, a.username, a.name, a.first_name, a.last_name, a.phone, a.status, a.is_super, r.name as role_name, a.role_id, a.created_at
    FROM admins a
    LEFT JOIN roles r ON a.role_id = r.id
    ORDER BY a.id DESC
  `).all();
  res.json(users);
});

app.post('/api/users', requirePermission('users:edit'), (req, res) => {
  const { username, password, name, first_name, last_name, phone, role_id, is_super } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(`
      INSERT INTO admins (username, password, name, first_name, last_name, phone, role_id, is_super)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashed, name, first_name, last_name, phone, role_id || null, is_super ? 1 : 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.put('/api/users/:id', requirePermission('users:edit'), (req, res) => {
  const { name, first_name, last_name, phone, role_id, is_super, status, password } = req.body;
  try {
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare(`
        UPDATE admins SET name=?, first_name=?, last_name=?, phone=?, role_id=?, is_super=?, status=?, password=?
        WHERE id=?
      `).run(name, first_name, last_name, phone, role_id || null, is_super ? 1 : 0, status, hashed, req.params.id);
    } else {
      db.prepare(`
        UPDATE admins SET name=?, first_name=?, last_name=?, phone=?, role_id=?, is_super=?, status=?
        WHERE id=?
      `).run(name, first_name, last_name, phone, role_id || null, is_super ? 1 : 0, status, req.params.id);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.delete('/api/users/:id', requirePermission('users:delete'), (req, res) => {
  db.prepare('DELETE FROM admins WHERE id = ? AND is_super = 0').run(req.params.id);
  res.json({ success: true });
});

// ── ROLE MANAGEMENT ──────────────────────────────────────────────────────────

app.get('/api/roles', requirePermission('roles:view'), (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
  const processed = roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') }));
  res.json(processed);
});

app.post('/api/roles', requirePermission('roles:edit'), (req, res) => {
  const { name, description, permissions } = req.body;
  try {
    const result = db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)')
      .run(name, description, JSON.stringify(permissions || []));
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.put('/api/roles/:id', requirePermission('roles:edit'), (req, res) => {
  const { name, description, permissions } = req.body;
  try {
    db.prepare('UPDATE roles SET name=?, description=?, permissions=? WHERE id=?')
      .run(name, description, JSON.stringify(permissions || []), req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.delete('/api/roles/:id', requirePermission('roles:delete'), (req, res) => {
  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── TAMIL TRANSLITERATION PROXY ────────────────────────────────────────────────
app.get('/api/transliterate', (req, res) => {
  const { text } = req.query;
  if (!text || !text.trim()) return res.json({ result: '' });

  const https = require('https');
  const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text.trim())}&itc=ta-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;

  https.get(url, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed[0] === 'SUCCESS' && parsed[1]?.[0]?.[1]?.[0]) {
          res.json({ result: parsed[1][0][1][0] });
        } else {
          res.json({ result: text });
        }
      } catch (e) { res.json({ result: text }); }
    });
  }).on('error', () => res.json({ result: text }));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MCC School System Successfully Running on port: ${PORT}`);
});
