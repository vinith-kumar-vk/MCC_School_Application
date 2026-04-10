const db = require('better-sqlite3')('new_concept.db');
const fields = db.prepare('SELECT id, label FROM form_fields').all();
const updates = [];

fields.forEach(f => {
  // Pattern: 
  // optionally matches "12. "
  // optionally matches "a. "
  // optionally matches "Part I: "
  let newL = f.label.replace(/^(\d+\.)?\s*([a-z]\.\s+)?(Part [IVX]+:\s*)?/i, '').trim();
  
  if (newL !== f.label) {
    updates.push({ id: f.id, old: f.label, newL: newL });
  }
});

console.log(JSON.stringify(updates, null, 2));
