const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.join(__dirname, 'new_concept.db');
const db = new Database(dbPath);

console.log('--- DEFINITIVE FIX ---');

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    role_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Activated',
    is_super INTEGER DEFAULT 0,
    FOREIGN KEY (role_id) REFERENCES roles (id)
  );
`);

// Add columns if missing (in case table existed but columns didn't)
try { db.exec("ALTER TABLE admins ADD COLUMN role_id INTEGER"); } catch(e){}
try { db.exec("ALTER TABLE admins ADD COLUMN first_name TEXT"); } catch(e){}
try { db.exec("ALTER TABLE admins ADD COLUMN last_name TEXT"); } catch(e){}
try { db.exec("ALTER TABLE admins ADD COLUMN phone TEXT"); } catch(e){}
try { db.exec("ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'Activated'"); } catch(e){}
try { db.exec("ALTER TABLE admins ADD COLUMN is_super INTEGER DEFAULT 0"); } catch(e){}

// 1. Setup 'admin' role with limited permissions
const restrictedPerms = JSON.stringify(['dashboard:view', 'applications:view']);
db.prepare("INSERT OR IGNORE INTO roles (name, description, permissions) VALUES ('admin', 'Restricted Admin', ?)").run(restrictedPerms);
db.prepare("UPDATE roles SET permissions = ? WHERE name = 'admin'").run(restrictedPerms);

const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();

// 2. Setup 'mccadmin' user
const hashed = bcrypt.hashSync('admin1234', 10);
const existingUser = db.prepare("SELECT id FROM admins WHERE username = 'mccadmin'").get();
if (existingUser) {
    db.prepare("UPDATE admins SET password = ?, role_id = ?, is_super = 0, name = 'MCC Admin' WHERE id = ?")
      .run(hashed, adminRole.id, existingUser.id);
} else {
    db.prepare("INSERT INTO admins (username, password, name, role_id, is_super) VALUES ('mccadmin', ?, 'MCC Admin', ?, 0)")
      .run(hashed, adminRole.id);
}

// 3. Setup 'mccmrfadmin' as Root
const rootHashed = bcrypt.hashSync('admin1234', 10);
const existingRoot = db.prepare("SELECT id FROM admins WHERE username = 'mccmrfadmin'").get();
if (existingRoot) {
    db.prepare("UPDATE admins SET is_super = 1 WHERE id = ?").run(existingRoot.id);
} else {
    db.prepare("INSERT INTO admins (username, password, name, is_super) VALUES ('mccmrfadmin', ?, 'Super Admin', 1)")
      .run(rootHashed);
}

console.log('Fix complete. User: mccadmin, Pass: admin1234');
