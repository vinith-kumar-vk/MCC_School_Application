const db = require('better-sqlite3')('new_concept.db');

const updates = [
  { name: 'gender', type: 'select', opts: 'Male,Female,Transgender' },
  { name: 'religion', type: 'select', opts: 'Hindu,Christian,Muslim,Others' },
  { name: 'blood_group', type: 'select', opts: 'A+,A-,B+,B-,O+,O-,AB+,AB-' },
  { name: 'nationality', type: 'select', opts: 'Indian,NRI,Others' },
  { name: 'mother_tongue', type: 'select', opts: 'Tamil,English,Malayalam,Telugu,Kannada,Hindi,Others' },
  { name: 'medium_instruction', type: 'select', opts: 'Tamil,English' },
  { name: 'physically_challenged', type: 'select', opts: 'No,Yes' },
  { name: 'first_grad', type: 'select', opts: 'No,Yes' },
  { name: 'second_lang', type: 'select', opts: 'Tamil,French,Hindi,Sanskrit' }
];

console.log('--- Starting Dropdown Updates ---');

// எல்லா Form-களிலும் இந்த பெயரில் உள்ள fields-ஐ update செய்கிறோம்
for (const field of updates) {
  const r = db.prepare(`
    UPDATE form_fields 
    SET field_type = ?, 
        options = ?,
        placeholder = 'Select ' || REPLACE(field_name, '_', ' ')
    WHERE field_name LIKE ?
  `).run(field.type, field.opts, `%${field.name}%`);
  
  if (r.changes > 0) {
      console.log(`Updated ${r.changes} fields for: ${field.name}`);
  }
}

// ── Class XI Group Options ───────────────────────────────────────────────────
// Form 2-ல் (Class XI) இருக்கும் 'Group' field-ஐயும் dropdown ஆக்குகிறோம்
const grpOpts = "Group 1: Maths/Biology/Physics/Chemistry,Group 2: Maths/CS/Physics/Chemistry,Group 3: Accounts/Commerce/Economics/BM,Group 4: Accounts/Commerce/Economics/Vocational";
const grpUpd = db.prepare(`
  UPDATE form_fields 
  SET field_type = 'select', 
      options = ?,
      placeholder = 'Select Preferred Group'
  WHERE field_name LIKE '%group%'
`).run(grpOpts);
if (grpUpd.changes > 0) console.log('XI Group options updated:', grpUpd.changes);

db.close();
console.log('--- All Dropdowns Ready ---');
