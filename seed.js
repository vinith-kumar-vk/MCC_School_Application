const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'mcc_school_form.db'));

try {
  // Clear first if needed
  db.prepare('DELETE FROM applications').run();

  const insert = db.prepare(`
    INSERT INTO applications (
      pupil_name, admission_class, dob, gender, religion, community,
      mother_tongue, father_name, mother_name, group_selected,
      marks_total, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    'Arun Kumar', 'XI', '2009-05-15', 'Male', 'Hindu', 'BC',
    'Tamil', 'Kumar V', 'Deepa K', 'Science (Phy/Che/Bio/Mat)',
    '475', 'Approved', new Date(Date.now() - 1000 * 60 * 120).toISOString()
  );

  insert.run(
    'Meera Jasmine', 'XI', '2009-08-20', 'Female', 'Christian', 'MBC',
    'Malayalam', 'Jasmine S', 'Mary J', 'Commerce (Com/Acc/Eco/CA)',
    '450', 'Pending', new Date(Date.now() - 1000 * 60 * 30).toISOString()
  );

  insert.run(
    'Siddharth R', 'XI', '2009-03-10', 'Male', 'Hindu', 'SC',
    'Tamil', 'Ravi M', 'Latha R', 'Science (Phy/Che/Mat/CS)',
    '490', 'Approved', new Date(Date.now() - 1000 * 60 * 5).toISOString()
  );

  console.log('✅ School seed data inserted successfully!');
} catch (err) {
  console.error('❌ Error seeding school data:', err);
} finally {
  db.close();
}
