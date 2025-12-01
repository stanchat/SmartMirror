const db = require('./index');

const ServicesRepo = {
    async getAll(activeOnly = true) {
        const sql = activeOnly 
            ? 'SELECT * FROM services WHERE is_active = true ORDER BY name'
            : 'SELECT * FROM services ORDER BY name';
        const result = await db.query(sql);
        return result.rows;
    },

    async getById(id) {
        const result = await db.query('SELECT * FROM services WHERE id = $1', [id]);
        return result.rows[0];
    },

    async create(service) {
        const result = await db.query(
            `INSERT INTO services (name, description, duration_minutes, price_cents, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [service.name, service.description, service.duration_minutes, service.price_cents, service.is_active ?? true]
        );
        return result.rows[0];
    },

    async update(id, service) {
        const result = await db.query(
            `UPDATE services SET name = $1, description = $2, duration_minutes = $3, 
             price_cents = $4, is_active = $5 WHERE id = $6 RETURNING *`,
            [service.name, service.description, service.duration_minutes, service.price_cents, service.is_active, id]
        );
        return result.rows[0];
    },

    async delete(id) {
        await db.query('UPDATE services SET is_active = false WHERE id = $1', [id]);
        return true;
    }
};

const UsersRepo = {
    async getAll() {
        const result = await db.query('SELECT * FROM users ORDER BY name');
        return result.rows;
    },

    async getById(id) {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async getByName(name) {
        const result = await db.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [name]);
        return result.rows[0];
    },

    async getByTelegramChatId(chatId) {
        const result = await db.query('SELECT * FROM users WHERE telegram_chat_id = $1', [chatId]);
        return result.rows[0];
    },

    async create(user) {
        const result = await db.query(
            `INSERT INTO users (name, telegram_chat_id, face_descriptor, face_image_path, azure_person_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
            [
                user.name, 
                user.telegram_chat_id, 
                user.face_descriptor ? JSON.stringify(user.face_descriptor) : null, 
                user.face_image_path,
                user.azure_person_id
            ]
        );
        return result.rows[0];
    },

    async update(id, updates) {
        const fields = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'face_descriptor') {
                fields.push(`${key} = $${idx}`);
                values.push(JSON.stringify(value));
            } else {
                fields.push(`${key} = $${idx}`);
                values.push(value);
            }
            idx++;
        }
        values.push(id);

        const result = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async incrementRecognition(id) {
        const result = await db.query(
            `UPDATE users SET recognition_count = recognition_count + 1, last_seen = NOW() 
             WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    async getAllWithDescriptors() {
        const result = await db.query(
            'SELECT id, name, face_descriptor FROM users WHERE face_descriptor IS NOT NULL'
        );
        return result.rows;
    },

    async getPending() {
        const result = await db.query(
            `SELECT * FROM users WHERE face_descriptor IS NULL AND 
             created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1`
        );
        if (result.rows.length > 0) {
            return { status: 'pending', ...result.rows[0] };
        }
        return null;
    },

    async completePending(id, faceDescriptor) {
        const result = await db.query(
            `UPDATE users SET face_descriptor = $1 WHERE id = $2 RETURNING *`,
            [JSON.stringify(faceDescriptor), id]
        );
        return result.rows[0];
    }
};

const AppointmentsRepo = {
    async getByDate(date) {
        const result = await db.query(
            `SELECT a.*, s.name as service_name, s.price_cents 
             FROM appointments a 
             LEFT JOIN services s ON a.service_id = s.id
             WHERE a.appointment_date = $1 AND a.status = 'scheduled'
             ORDER BY a.start_time`,
            [date]
        );
        return result.rows;
    },

    async getAll() {
        const result = await db.query(
            `SELECT a.*, s.name as service_name, s.price_cents 
             FROM appointments a 
             LEFT JOIN services s ON a.service_id = s.id
             ORDER BY a.appointment_date DESC, a.start_time`
        );
        return result.rows;
    },

    async create(appointment) {
        const timeSlotToTime = {
            'slot_0900': '09:00', 'slot_1000': '10:00', 'slot_1100': '11:00',
            'slot_1200': '12:00', 'slot_1300': '13:00', 'slot_1400': '14:00',
            'slot_1500': '15:00', 'slot_1600': '16:00', 'slot_1700': '17:00'
        };
        const startTime = timeSlotToTime[appointment.time_slot] || '12:00';

        const result = await db.query(
            `INSERT INTO appointments 
             (user_id, service_id, client_name, appointment_date, time_slot, start_time, barber, booked_via, booked_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                appointment.user_id, appointment.service_id, appointment.client_name,
                appointment.appointment_date, appointment.time_slot, startTime,
                appointment.barber || 'Any', appointment.booked_via || 'telegram', appointment.booked_by
            ]
        );
        return result.rows[0];
    },

    async checkConflict(date, timeSlot) {
        const result = await db.query(
            `SELECT id FROM appointments 
             WHERE appointment_date = $1 AND time_slot = $2 AND status = 'scheduled'`,
            [date, timeSlot]
        );
        return result.rows.length > 0;
    },

    async cancel(id) {
        const result = await db.query(
            `UPDATE appointments SET status = 'cancelled', updated_at = NOW() 
             WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    async complete(id) {
        const result = await db.query(
            `UPDATE appointments SET status = 'completed', updated_at = NOW() 
             WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
};

const TransactionsRepo = {
    async getRecent(limit = 20) {
        const result = await db.query(
            'SELECT * FROM transactions ORDER BY occurred_at DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    },

    async create(transaction) {
        const result = await db.query(
            `INSERT INTO transactions (appointment_id, user_id, amount_cents, service_name, client_name, payment_method)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                transaction.appointment_id, transaction.user_id, transaction.amount_cents,
                transaction.service_name, transaction.client_name, transaction.payment_method || 'cash'
            ]
        );
        return result.rows[0];
    },

    async getWeeklyTotal() {
        const result = await db.query(
            `SELECT COALESCE(SUM(amount_cents), 0) as total 
             FROM transactions 
             WHERE occurred_at >= DATE_TRUNC('week', CURRENT_DATE)`
        );
        return parseInt(result.rows[0].total);
    },

    async getMonthlyTotal() {
        const result = await db.query(
            `SELECT COALESCE(SUM(amount_cents), 0) as total 
             FROM transactions 
             WHERE occurred_at >= DATE_TRUNC('month', CURRENT_DATE)`
        );
        return parseInt(result.rows[0].total);
    }
};

const MessagesRepo = {
    async getRecent(limit = 10) {
        const result = await db.query(
            `SELECT * FROM messages WHERE is_command = false 
             ORDER BY sent_at DESC LIMIT $1`,
            [limit]
        );
        return result.rows;
    },

    async getNew() {
        const result = await db.query(
            `SELECT * FROM messages WHERE is_new = true AND is_command = false 
             ORDER BY sent_at DESC`
        );
        return result.rows;
    },

    async create(message) {
        const isCommand = message.text.startsWith('/');
        const result = await db.query(
            `INSERT INTO messages (user_id, chat_id, sender, text, is_command, is_new)
             VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
            [message.user_id, message.chat_id, message.sender, message.text, isCommand]
        );
        return result.rows[0];
    },

    async markAsRead(id) {
        await db.query('UPDATE messages SET is_new = false WHERE id = $1', [id]);
    },

    async markAllAsRead() {
        await db.query('UPDATE messages SET is_new = false WHERE is_new = true');
    }
};

const BudgetRepo = {
    async getTargets() {
        const result = await db.query('SELECT * FROM budget_targets ORDER BY period');
        return result.rows;
    },

    async updateTarget(period, goalCents) {
        const result = await db.query(
            `UPDATE budget_targets SET goal_cents = $1 WHERE period = $2 RETURNING *`,
            [goalCents, period]
        );
        if (result.rows.length === 0) {
            return (await db.query(
                `INSERT INTO budget_targets (period, goal_cents, period_start) 
                 VALUES ($1, $2, CURRENT_DATE) RETURNING *`,
                [period, goalCents]
            )).rows[0];
        }
        return result.rows[0];
    },

    async getBudgetSummary() {
        const [weeklyTotal, monthlyTotal, targets] = await Promise.all([
            TransactionsRepo.getWeeklyTotal(),
            TransactionsRepo.getMonthlyTotal(),
            this.getTargets()
        ]);

        const weeklyTarget = targets.find(t => t.period === 'weekly');
        const monthlyTarget = targets.find(t => t.period === 'monthly');

        return {
            weekly_goal: weeklyTarget ? weeklyTarget.goal_cents : 200000,
            monthly_goal: monthlyTarget ? monthlyTarget.goal_cents : 800000,
            current_week_earned: weeklyTotal,
            current_month_earned: monthlyTotal
        };
    }
};

const RecognitionRepo = {
    async log(userId, userName, confidence) {
        const result = await db.query(
            `INSERT INTO recognition_events (user_id, user_name, confidence)
             VALUES ($1, $2, $3) RETURNING *`,
            [userId, userName, confidence]
        );
        return result.rows[0];
    },

    async getRecent(limit = 20) {
        const result = await db.query(
            'SELECT * FROM recognition_events ORDER BY detected_at DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    }
};

module.exports = {
    ServicesRepo,
    UsersRepo,
    AppointmentsRepo,
    TransactionsRepo,
    MessagesRepo,
    BudgetRepo,
    RecognitionRepo
};
