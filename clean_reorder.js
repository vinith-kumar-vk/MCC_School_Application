const db = require('better-sqlite3')('new_concept.db');

// 1. "Caste" என்ற பெயரில் உள்ள அனைத்தையும் நீக்குகிறோம் (Capital C மற்றும் Small c)
const del = db.prepare("DELETE FROM form_fields WHERE LOWER(field_name) = 'caste'").run();
console.log('Deleted Caste fields:', del.changes);

// 2. அனைத்து Field-களையும் வரிசையாக அடுக்குகிறோம் (Re-sequencing)
const forms = db.prepare("SELECT id FROM forms").all();

db.transaction(() => {
    for (const form of forms) {
        // ஒவ்வொரு Step-க்கும் தனித்தனியாக 1-ல் இருந்து எண்களைத் தொடங்குகிறோம்
        for (let step = 1; step <= 4; step++) {
            const fields = db.prepare("SELECT id FROM form_fields WHERE form_id = ? AND step = ? AND is_active = 1 ORDER BY sort_order, id").all(form.id, step);
            fields.forEach((f, idx) => {
                db.prepare("UPDATE form_fields SET sort_order = ? WHERE id = ?").run(idx + 1, f.id);
            });
            if (fields.length > 0) console.log(`Form ${form.id} Step ${step}: Resequenced ${fields.length} fields.`);
        }
    }
})();

console.log('--- RE-SEQUENCING COMPLETED ---');
db.close();
