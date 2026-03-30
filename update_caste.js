const db = require('better-sqlite3')('new_concept.db');

// Caste field-ஐ தேடி அதை dropdown (select) ஆக மாற்றுகிறோம்
// Options column-ல் ஆப்ஷன்களைச் சேர்க்கிறோம்
const casteOptions = "OC,BC,BC(M),MBC,DNC,SC,SC(A),ST";

const r = db.prepare(`
  UPDATE form_fields 
  SET field_type = 'select', 
      options = ? 
  WHERE field_name LIKE '%caste%'
`).run(casteOptions);

console.log('Caste fields updated:', r.changes);

const check = db.prepare("SELECT field_name, field_type, options FROM form_fields WHERE field_name LIKE '%caste%'").all();
console.log('Current Caste field state:', check);

db.close();
