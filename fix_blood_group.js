const db = require('better-sqlite3')('new_concept.db');

// Blood types exactly like O+, B+, A+ labels
const bloodOpts = "A+,A-,B+,B-,O+,O-,AB+,AB-";

// Blood group field everywhere (pupil, parents if exist)
const r = db.prepare(`
  UPDATE form_fields 
  SET field_type = 'select', 
      options = ?,
      placeholder = 'Example: O+'
  WHERE field_name LIKE '%blood%'
`).run(bloodOpts);

console.log('Blood group dropdowns updated:', r.changes);

const check = db.prepare("SELECT field_name, options FROM form_fields WHERE field_name LIKE '%blood%'").all();
console.log('Verification:', check);

db.close();
