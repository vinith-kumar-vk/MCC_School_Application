const db = require('better-sqlite3')('new_concept.db');
const fields = db.prepare('SELECT id, label FROM form_fields').all();

let count = 0;
const updateStmt = db.prepare('UPDATE form_fields SET label = ? WHERE id = ?');

// Run within a transaction for safety
const updateMany = db.transaction(() => {
  fields.forEach(f => {
    // We want to handle:
    // "1. Name" -> "Name"
    // "8. a. Caste" -> "Caste"
    // "19. Part I: First Language" -> "First Language"
    // "(2)" -> "(2)" or maybe remove it? The user just said numbers like "1.".
    // Let's also handle "12. e. Mobile No."
    
    let newL = f.label.replace(/^(\d+\.)?\s*([a-z]\.\s+)?(Part [IVX]+:\s*)?/i, '').trim();
    
    // In case there's something like "(1)" or "(2)" as full label:
    if (newL === '(2)') newL = 'Identification Mark 2';
    if (newL === '(1)') newL = 'Identification Mark 1';
    
    // Quick fix for "14. Identification marks (1)"
    if (f.label.includes('Identification marks (1)')) {
      newL = 'Identification marks (1)';
    }

    if (newL !== f.label) {
      console.log(`Updating [${f.id}]: "${f.label}" => "${newL}"`);
      updateStmt.run(newL, f.id);
      count++;
    }
  });
});

updateMany();
console.log(`Updated ${count} fields successfully.`);
