const db = require('better-sqlite3')('new_concept.db');

// 1. "Class Registered For" field-ஐ dropdown (LKG-X) ஆக மாற்றுகிறோம்
const classOptions = "LKG,UKG,I,II,III,IV,V,VI,VII,VIII,IX,X";
const r1 = db.prepare(`
  UPDATE form_fields 
  SET field_type = 'select', 
      options = ?,
      placeholder = 'Select Class Applying For'
  WHERE field_name LIKE '%registration_for%' 
     OR field_name LIKE '%applying_for%'
     OR field_name LIKE '%class_registered%'
`).run(classOptions);
console.log('Class list updated:', r1.changes);

// 2. Identification Marks (1) & (2) - இவற்றுக்கு சரியான Label மற்றும் Placeholders 
// Field names: id_mark1, id_mark2
const mark1 = db.prepare(`
  UPDATE form_fields 
  SET label = 'Identification marks (1)', 
      placeholder = 'Example: A mole on left cheek',
      field_type = 'text',
      required = 1
  WHERE field_name LIKE '%mark1%' 
     OR field_name LIKE '%id_mark_1%'
`).run();

const mark2 = db.prepare(`
  UPDATE form_fields 
  SET label = 'Identification marks (2)', 
      placeholder = 'Example: A scar on right hand',
      field_type = 'text',
      required = 0 
  WHERE field_name LIKE '%mark2%' 
     OR field_name LIKE '%id_mark_2%'
`).run();
console.log('ID marks updated');

// 3. Email and Mobile - இவை தனித்தனியாக இருப்பதை உறுதி செய்கிறோம்
// (ஏற்கனவே தனித்தனியாக இருந்ததால், அவற்றின் Label-ஐ மட்டும் தெளிவாக மாற்றுகிறேன்)
const contact = db.prepare(`
  UPDATE form_fields 
  SET label = 'Contact Number (Mobile)', 
      placeholder = 'Enter 10 digit mobile number'
  WHERE field_name LIKE '%mobile%' OR field_name LIKE '%phone%'
     OR field_name LIKE '%contact%'
`).run();

const email = db.prepare(`
  UPDATE form_fields 
  SET label = 'Email ID', 
      placeholder = 'Example: someone@gmail.com'
  WHERE field_name LIKE '%email%'
`).run();
console.log('Contact/Email fields updated');

db.close();
console.log('--- Setup Completed ---');
