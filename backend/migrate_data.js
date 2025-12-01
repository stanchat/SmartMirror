const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrateData() {
    const dataFile = path.join(__dirname, 'data.json');
    
    if (!fs.existsSync(dataFile)) {
        console.log('No data.json found, skipping migration');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    console.log('Migrating data from data.json...');

    try {
        for (const user of (data.users || [])) {
            const existing = await db.query('SELECT id FROM users WHERE LOWER(name) = LOWER($1)', [user.name]);
            if (existing.rows.length === 0) {
                await db.query(
                    `INSERT INTO users (name, face_descriptor, face_image_path, recognition_count, created_at, last_seen)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        user.name,
                        user.face_descriptor ? JSON.stringify(user.face_descriptor) : null,
                        user.face_image,
                        user.recognition_count || 0,
                        user.trained_at || new Date().toISOString(),
                        user.last_seen || null
                    ]
                );
                console.log(`  Migrated user: ${user.name}`);
            } else {
                console.log(`  User ${user.name} already exists, skipping`);
            }
        }

        for (const apt of (data.appointments || [])) {
            const timeToSlot = {
                '9:00 AM': 'slot_0900', '10:00 AM': 'slot_1000', '11:00 AM': 'slot_1100',
                '12:00 PM': 'slot_1200', '1:00 PM': 'slot_1300', '2:00 PM': 'slot_1400',
                '3:00 PM': 'slot_1500', '4:00 PM': 'slot_1600', '5:00 PM': 'slot_1700'
            };
            const timeSlot = timeToSlot[apt.time] || 'slot_1200';
            
            const serviceResult = await db.query('SELECT id FROM services WHERE LOWER(name) = LOWER($1)', [apt.service]);
            const serviceId = serviceResult.rows.length > 0 ? serviceResult.rows[0].id : null;

            await db.query(
                `INSERT INTO appointments (client_name, service_id, appointment_date, time_slot, start_time, barber, booked_via, booked_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    apt.client || apt.user,
                    serviceId,
                    apt.date === 'today' ? new Date().toISOString().split('T')[0] : apt.date,
                    timeSlot,
                    apt.time.replace(/ AM| PM/g, '').padStart(5, '0'),
                    apt.barber || 'Any',
                    apt.booked_via || 'manual',
                    apt.booked_by || 'Admin'
                ]
            );
            console.log(`  Migrated appointment: ${apt.client || apt.user} at ${apt.time}`);
        }

        if (data.budget) {
            await db.query('UPDATE budget_targets SET goal_cents = $1 WHERE period = $2', 
                [data.budget.weekly_goal * 100, 'weekly']);
            await db.query('UPDATE budget_targets SET goal_cents = $1 WHERE period = $2', 
                [data.budget.monthly_goal * 100, 'monthly']);
            
            for (const tx of (data.budget.transactions || [])) {
                await db.query(
                    `INSERT INTO transactions (amount_cents, service_name, client_name, occurred_at)
                     VALUES ($1, $2, $3, $4)`,
                    [tx.amount * 100, tx.service, tx.client, tx.date]
                );
                console.log(`  Migrated transaction: $${tx.amount} from ${tx.client}`);
            }
        }

        for (const msg of (data.telegram_messages || [])) {
            if (!msg.text.startsWith('/')) {
                await db.query(
                    `INSERT INTO messages (chat_id, sender, text, is_command, is_new, sent_at)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [msg.chat_id, msg.sender, msg.text, false, msg.isNew, msg.timestamp]
                );
                console.log(`  Migrated message from ${msg.sender}`);
            }
        }

        for (const event of (data.recognition_log || [])) {
            await db.query(
                `INSERT INTO recognition_events (user_name, confidence, detected_at)
                 VALUES ($1, $2, $3)`,
                [event.user_name || event.user, event.confidence || 0.95, event.timestamp]
            );
        }

        console.log('Data migration completed successfully!');
        
        const backupPath = path.join(__dirname, 'data.json.backup');
        fs.copyFileSync(dataFile, backupPath);
        console.log(`Original data backed up to ${backupPath}`);

    } catch (err) {
        console.error('Migration error:', err);
        throw err;
    }
}

if (require.main === module) {
    migrateData()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { migrateData };
