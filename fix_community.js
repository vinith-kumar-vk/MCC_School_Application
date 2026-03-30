const db = require('better-sqlite3')('new_concept.db');

// 1. Caste field-ஐ நீக்குகிறோம் (Redundant)
const r1 = db.prepare("DELETE FROM form_fields WHERE field_name = 'caste'").run();
console.log('Caste fields removed:', r1.changes);

// 2. Community field-ஐ Dropdown (select) ஆக மாற்றி ஆப்ஷன்களைச் சேர்க்கிறோம்
const comOptions = "OC,BC,BC(M),MBC,DNC,SC,SC(A),ST";
const r2 = db.prepare(`
  UPDATE form_fields 
  SET field_type = 'select', 
      options = ?,
      required = 1,
      placeholder = 'Select Community'
  WHERE field_name = 'community'
`).run(comOptions);

console.log('Community fields updated:', r2.changes);

const check = db.prepare("SELECT field_name, field_type, options, required FROM form_fields WHERE field_name = 'community'").all();
console.log('Verification:', check);

db.close();
