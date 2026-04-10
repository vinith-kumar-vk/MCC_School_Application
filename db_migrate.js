const Database = require('better-sqlite3');
const path = require('path');

console.log("Connecting to database...");
const db = new Database(path.join(__dirname, 'new_concept.db'));

try {
  console.log("Attempting to add 'subtitle' column to forms table...");
  db.prepare("ALTER TABLE forms ADD COLUMN subtitle TEXT").run();
  console.log("✅ Success! 'subtitle' column added.");
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log("✅ 'subtitle' column already exists in forms table. You are good to go!");
  } else {
    console.error("❌ Failed to add column. Error:", e.message);
  }
}

console.log("Migration complete. You can now start/restart your server.");
