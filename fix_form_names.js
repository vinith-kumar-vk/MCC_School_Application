const db = require('better-sqlite3')('new_concept.db');

db.prepare("UPDATE forms SET name = 'Pre-kg to UKG ADMISSION FORM' WHERE id = 1").run();
db.prepare("UPDATE forms SET name = 'Class XI Admission Form' WHERE id = 2").run();

console.log("Form names updated successfully in database.");
