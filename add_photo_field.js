const db = require('better-sqlite3')('new_concept.db');

// Add photograph field to Form 1 and Form 2
const forms = [1, 2];

forms.forEach(formId => {
    // Check if photograph field already exists
    const exists = db.prepare("SELECT id FROM form_fields WHERE form_id = ? AND field_name = 'photograph'").get(formId);
    
    if (!exists) {
        db.prepare(`
            INSERT INTO form_fields (form_id, step, field_type, field_name, label, placeholder, required, options, sort_order, column_width)
            VALUES (?, 1, 'photograph', 'photograph', 'Passport Size Photograph', '', 1, NULL, 3, 3)
        `).run(formId);
        console.log(`Added photograph field to Form ${formId}`);
    } else {
        console.log(`Photograph field already exists for Form ${formId}`);
    }
});

// Re-sequence fields to avoid duplicate sort_orders
forms.forEach(formId => {
    const fields = db.prepare("SELECT id FROM form_fields WHERE form_id = ? AND step = 1 AND is_active = 1 ORDER BY sort_order, id").all(formId);
    fields.forEach((f, idx) => {
        db.prepare("UPDATE form_fields SET sort_order = ? WHERE id = ?").run(idx + 1, f.id);
    });
});

console.log('--- RE-SEQUENCING COMPLETED ---');
db.close();
