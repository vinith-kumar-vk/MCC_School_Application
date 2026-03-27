const Database = require('better-sqlite3');
const db = new Database('mcc_school_form.db');
try {
  console.log('--- ADMINS ---');
  console.log(db.prepare("PRAGMA table_info(admins)").all());
  console.log('--- APPLICATIONS ---');
  console.log(db.prepare("PRAGMA table_info(applications)").all());
} finally {
  db.close();
}
