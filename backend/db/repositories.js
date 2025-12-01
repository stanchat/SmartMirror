const db = require('./index');
const crypto = require('crypto');

const ShopsRepo = {
    async getAll() {
        const result = await db.query('SELECT * FROM shops WHERE is_active = true ORDER BY name');
        return result.rows;
    },

    async getById(id) {
        const result = await db.query('SELECT * FROM shops WHERE id = $1', [id]);
        return result.rows[0];
    },

    async getBySlug(slug) {
        const result = await db.query('SELECT * FROM shops WHERE slug = $1', [slug]);
        return result.rows[0];
    },

    async create(shop) {
        const slug = shop.slug || shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const result = await db.query(
            `INSERT INTO shops (name, slug, address, phone, email, timezone, business_hours, telegram_bot_token)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [shop.name, slug, shop.address, shop.phone, shop.email, 
             shop.timezone || 'America/Chicago', 
             JSON.stringify(shop.business_hours || {}),
             shop.telegram_bot_token]
        );
        return result.rows[0];
    },

    async update(id, shop) {
        const fields = [];
        const values = [];
        let idx = 1;
        
        const allowed = ['name', 'address', 'phone', 'email', 'timezone', 'business_hours', 'settings', 'telegram_bot_token', 'is_active'];
        for (const [key, value] of Object.entries(shop)) {
            if (allowed.includes(key)) {
                fields.push(`${key} = $${idx}`);
                values.push(key === 'business_hours' || key === 'settings' ? JSON.stringify(value) : value);
                idx++;
            }
        }
        if (fields.length === 0) return this.getById(id);
        
        fields.push(`updated_at = NOW()`);
        values.push(id);
        
        const result = await db.query(
            `UPDATE shops SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        return result.rows[0];
    }
};

const BarbersRepo = {
    async getByShop(shopId, includeInactive = false) {
        const sql = includeInactive
            ? 'SELECT * FROM barbers WHERE shop_id = $1 ORDER BY name'
            : 'SELECT * FROM barbers WHERE shop_id = $1 AND is_active = true ORDER BY name';
        const result = await db.query(sql, [shopId]);
        return result.rows;
    },

    async getById(id) {
        const result = await db.query('SELECT * FROM barbers WHERE id = $1', [id]);
        return result.rows[0];
    },

    async getByPinCode(shopId, pinCode) {
        const result = await db.query(
            'SELECT * FROM barbers WHERE shop_id = $1 AND pin_code = $2 AND is_active = true',
            [shopId, pinCode]
        );
        return result.rows[0];
    },

    async getByEmail(shopId, email) {
        const result = await db.query(
            'SELECT * FROM barbers WHERE shop_id = $1 AND email = $2',
            [shopId, email]
        );
        return result.rows[0];
    },

    async getAdmins(shopId) {
        const result = await db.query(
            'SELECT * FROM barbers WHERE shop_id = $1 AND role = $2 AND is_active = true',
            [shopId, 'admin']
        );
        return result.rows;
    },

    async create(barber) {
        const result = await db.query(
            `INSERT INTO barbers (shop_id, name, email, phone, pin_code, role, color, telegram_chat_id, working_hours)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                barber.shop_id, barber.name, barber.email, barber.phone, 
                barber.pin_code, barber.role || 'barber',
                barber.color || '#3498db', barber.telegram_chat_id,
                JSON.stringify(barber.working_hours || {})
            ]
        );
        return result.rows[0];
    },

    async update(id, barber) {
        const fields = [];
        const values = [];
        let idx = 1;
        
        const allowed = ['name', 'email', 'phone', 'pin_code', 'role', 'color', 'telegram_chat_id', 'working_hours', 'is_active', 'face_descriptor', 'face_image_path'];
        for (const [key, value] of Object.entries(barber)) {
            if (allowed.includes(key)) {
                fields.push(`${key} = $${idx}`);
                if (key === 'working_hours' || key === 'face_descriptor') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
                idx++;
            }
        }
        if (fields.length === 0) return this.getById(id);
        
        fields.push(`updated_at = NOW()`);
        values.push(id);
        
        const result = await db.query(
            `UPDATE barbers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async delete(id) {
        await db.query('UPDATE barbers SET is_active = false WHERE id = $1', [id]);
        return true;
    },

    async clockIn(barberId, mirrorId) {
        await db.query('UPDATE barbers SET last_clock_in = NOW() WHERE id = $1', [barberId]);
        const result = await db.query(
            `INSERT INTO mirror_sessions (mirror_id, barber_id, clock_in, is_active)
             VALUES ($1, $2, NOW(), true) RETURNING *`,
            [mirrorId, barberId]
        );
        return result.rows[0];
    },

    async clockOut(barberId) {
        const result = await db.query(
            `UPDATE mirror_sessions SET clock_out = NOW(), is_active = false 
             WHERE barber_id = $1 AND is_active = true RETURNING *`,
            [barberId]
        );
        return result.rows[0];
    },

    async getActiveSession(barberId) {
        const result = await db.query(
            `SELECT ms.*, md.label as mirror_label 
             FROM mirror_sessions ms
             JOIN mirror_devices md ON ms.mirror_id = md.id
             WHERE ms.barber_id = $1 AND ms.is_active = true`,
            [barberId]
        );
        return result.rows[0];
    }
};

const MirrorsRepo = {
    async getByShop(shopId) {
        const result = await db.query(
            'SELECT * FROM mirror_devices WHERE shop_id = $1 ORDER BY label',
            [shopId]
        );
        return result.rows;
    },

    async getById(id) {
        const result = await db.query('SELECT * FROM mirror_devices WHERE id = $1', [id]);
        return result.rows[0];
    },

    async getByDeviceUid(deviceUid) {
        const result = await db.query(
            'SELECT * FROM mirror_devices WHERE device_uid = $1',
            [deviceUid]
        );
        return result.rows[0];
    },

    async getByRegistrationCode(code) {
        const result = await db.query(
            `SELECT * FROM mirror_devices 
             WHERE registration_code = $1 AND registration_expires > NOW()`,
            [code]
        );
        return result.rows[0];
    },

    async create(mirror) {
        const deviceUid = mirror.device_uid || crypto.randomBytes(16).toString('hex');
        const result = await db.query(
            `INSERT INTO mirror_devices (shop_id, device_uid, label, module_config)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [mirror.shop_id, deviceUid, mirror.label, JSON.stringify(mirror.module_config || {})]
        );
        return result.rows[0];
    },

    async generateRegistrationCode(mirrorId) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const result = await db.query(
            `UPDATE mirror_devices 
             SET registration_code = $1, registration_expires = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [code, expires, mirrorId]
        );
        return result.rows[0];
    },

    async registerDevice(code, deviceUid) {
        const deviceTokenHash = crypto.createHash('sha256')
            .update(deviceUid + Date.now().toString())
            .digest('hex');
        
        const result = await db.query(
            `UPDATE mirror_devices 
             SET device_uid = $1, device_token_hash = $2, 
                 registration_code = NULL, registration_expires = NULL,
                 status = 'online', last_seen = NOW(), updated_at = NOW()
             WHERE registration_code = $3 AND registration_expires > NOW()
             RETURNING *`,
            [deviceUid, deviceTokenHash, code]
        );
        return result.rows[0] ? { ...result.rows[0], device_token: deviceTokenHash } : null;
    },

    async updateStatus(id, status) {
        const result = await db.query(
            `UPDATE mirror_devices SET status = $1, last_seen = NOW(), updated_at = NOW()
             WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return result.rows[0];
    },

    async heartbeat(deviceUid) {
        const result = await db.query(
            `UPDATE mirror_devices SET last_seen = NOW(), status = 'online'
             WHERE device_uid = $1 RETURNING *`,
            [deviceUid]
        );
        return result.rows[0];
    },

    async update(id, mirror) {
        const fields = [];
        const values = [];
        let idx = 1;
        
        const allowed = ['label', 'module_config', 'is_active', 'status'];
        for (const [key, value] of Object.entries(mirror)) {
            if (allowed.includes(key)) {
                fields.push(`${key} = $${idx}`);
                values.push(key === 'module_config' ? JSON.stringify(value) : value);
                idx++;
            }
        }
        if (fields.length === 0) return this.getById(id);
        
        fields.push(`updated_at = NOW()`);
        values.push(id);
        
        const result = await db.query(
            `UPDATE mirror_devices SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async delete(id) {
        await db.query('UPDATE mirror_devices SET is_active = false WHERE id = $1', [id]);
        return true;
    },

    async getActiveBarber(mirrorId) {
        const result = await db.query(
            `SELECT b.* FROM barbers b
             JOIN mirror_sessions ms ON b.id = ms.barber_id
             WHERE ms.mirror_id = $1 AND ms.is_active = true`,
            [mirrorId]
        );
        return result.rows[0];
    }
};

const WalkInQueueRepo = {
    async getByShop(shopId, statusFilter = ['waiting', 'called']) {
        const result = await db.query(
            `SELECT wq.*, s.name as service_name, b.name as preferred_barber_name,
                    ab.name as assigned_barber_name
             FROM walk_in_queue wq
             LEFT JOIN services s ON wq.service_id = s.id
             LEFT JOIN barbers b ON wq.preferred_barber_id = b.id
             LEFT JOIN barbers ab ON wq.assigned_barber_id = ab.id
             WHERE wq.shop_id = $1 AND wq.status = ANY($2) AND DATE(wq.check_in_time) = CURRENT_DATE
             ORDER BY wq.queue_position`,
            [shopId, statusFilter]
        );
        return result.rows;
    },

    async add(queueEntry) {
        const positionResult = await db.query(
            'SELECT get_next_queue_position($1) as position',
            [queueEntry.shop_id]
        );
        const position = positionResult.rows[0].position;
        
        const result = await db.query(
            `INSERT INTO walk_in_queue 
             (shop_id, customer_id, customer_name, service_id, preferred_barber_id, queue_position)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [queueEntry.shop_id, queueEntry.customer_id, queueEntry.customer_name,
             queueEntry.service_id, queueEntry.preferred_barber_id, position]
        );
        return result.rows[0];
    },

    async callNext(shopId, barberId, mirrorId) {
        const result = await db.query(
            `UPDATE walk_in_queue 
             SET status = 'called', assigned_barber_id = $2, assigned_mirror_id = $3, called_time = NOW()
             WHERE id = (
                 SELECT id FROM walk_in_queue 
                 WHERE shop_id = $1 AND status = 'waiting'
                 ORDER BY queue_position LIMIT 1
             ) RETURNING *`,
            [shopId, barberId, mirrorId]
        );
        return result.rows[0];
    },

    async startService(queueId) {
        const result = await db.query(
            `UPDATE walk_in_queue SET status = 'in_service', service_start_time = NOW()
             WHERE id = $1 RETURNING *`,
            [queueId]
        );
        return result.rows[0];
    },

    async completeService(queueId) {
        const result = await db.query(
            `UPDATE walk_in_queue SET status = 'completed', service_end_time = NOW()
             WHERE id = $1 RETURNING *`,
            [queueId]
        );
        return result.rows[0];
    },

    async markNoShow(queueId) {
        const result = await db.query(
            `UPDATE walk_in_queue SET status = 'no_show' WHERE id = $1 RETURNING *`,
            [queueId]
        );
        return result.rows[0];
    },

    async getPosition(queueId) {
        const result = await db.query(
            `SELECT queue_position, 
                    (SELECT COUNT(*) FROM walk_in_queue wq2 
                     WHERE wq2.shop_id = wq.shop_id 
                     AND wq2.queue_position < wq.queue_position 
                     AND wq2.status = 'waiting'
                     AND DATE(wq2.check_in_time) = CURRENT_DATE) + 1 as current_position
             FROM walk_in_queue wq WHERE id = $1`,
            [queueId]
        );
        return result.rows[0];
    }
};

const ServicesRepo = {
    async getAll(shopId, activeOnly = true) {
        const sql = activeOnly 
            ? 'SELECT * FROM services WHERE shop_id = $1 AND is_active = true ORDER BY name'
            : 'SELECT * FROM services WHERE shop_id = $1 ORDER BY name';
        const result = await db.query(sql, [shopId]);
        return result.rows;
    },

    async getAllLegacy(activeOnly = true) {
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
            `INSERT INTO services (shop_id, name, description, duration_minutes, price_cents, is_active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [service.shop_id, service.name, service.description, service.duration_minutes, service.price_cents, service.is_active ?? true]
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
    async getAll(shopId) {
        const result = await db.query('SELECT * FROM users WHERE shop_id = $1 ORDER BY name', [shopId]);
        return result.rows;
    },

    async getAllLegacy() {
        const result = await db.query('SELECT * FROM users ORDER BY name');
        return result.rows;
    },

    async getById(id) {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async getByName(name, shopId = null) {
        if (shopId) {
            const result = await db.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1) AND shop_id = $2', [name, shopId]);
            return result.rows[0];
        }
        const result = await db.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [name]);
        return result.rows[0];
    },

    async getByTelegramChatId(chatId) {
        const result = await db.query('SELECT * FROM users WHERE telegram_chat_id = $1', [chatId]);
        return result.rows[0];
    },

    async create(user) {
        const result = await db.query(
            `INSERT INTO users (shop_id, name, telegram_chat_id, face_descriptor, face_image_path, azure_person_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [
                user.shop_id,
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

    async getAllWithDescriptors(shopId = null) {
        if (shopId) {
            const result = await db.query(
                'SELECT id, name, face_descriptor FROM users WHERE face_descriptor IS NOT NULL AND shop_id = $1',
                [shopId]
            );
            return result.rows;
        }
        const result = await db.query(
            'SELECT id, name, face_descriptor FROM users WHERE face_descriptor IS NOT NULL'
        );
        return result.rows;
    },

    async getPending(shopId = null) {
        const sql = shopId
            ? `SELECT * FROM users WHERE face_descriptor IS NULL AND shop_id = $1 AND 
               created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1`
            : `SELECT * FROM users WHERE face_descriptor IS NULL AND 
               created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1`;
        const result = await db.query(sql, shopId ? [shopId] : []);
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
    async getByDate(date, shopId = null, barberId = null) {
        let sql = `SELECT a.*, s.name as service_name, s.price_cents, b.name as barber_name
             FROM appointments a 
             LEFT JOIN services s ON a.service_id = s.id
             LEFT JOIN barbers b ON a.barber_id = b.id
             WHERE a.appointment_date = $1 AND a.status = 'scheduled'`;
        const params = [date];
        
        if (shopId) {
            sql += ` AND a.shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        if (barberId) {
            sql += ` AND a.barber_id = $${params.length + 1}`;
            params.push(barberId);
        }
        sql += ' ORDER BY a.start_time';
        
        const result = await db.query(sql, params);
        return result.rows;
    },

    async getAll(shopId = null, barberId = null) {
        let sql = `SELECT a.*, s.name as service_name, s.price_cents, b.name as barber_name
             FROM appointments a 
             LEFT JOIN services s ON a.service_id = s.id
             LEFT JOIN barbers b ON a.barber_id = b.id`;
        const params = [];
        const conditions = [];
        
        if (shopId) {
            conditions.push(`a.shop_id = $${params.length + 1}`);
            params.push(shopId);
        }
        if (barberId) {
            conditions.push(`a.barber_id = $${params.length + 1}`);
            params.push(barberId);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY a.appointment_date DESC, a.start_time';
        
        const result = await db.query(sql, params);
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
             (shop_id, user_id, service_id, client_name, appointment_date, time_slot, start_time, barber, barber_id, booked_via, booked_by, is_walk_in)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                appointment.shop_id, appointment.user_id, appointment.service_id, appointment.client_name,
                appointment.appointment_date, appointment.time_slot, startTime,
                appointment.barber || 'Any', appointment.barber_id, 
                appointment.booked_via || 'telegram', appointment.booked_by,
                appointment.is_walk_in || false
            ]
        );
        return result.rows[0];
    },

    async checkConflict(date, timeSlot, shopId = null, barberId = null) {
        let sql = `SELECT id FROM appointments 
             WHERE appointment_date = $1 AND time_slot = $2 AND status = 'scheduled'`;
        const params = [date, timeSlot];
        
        if (shopId) {
            sql += ` AND shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        if (barberId) {
            sql += ` AND barber_id = $${params.length + 1}`;
            params.push(barberId);
        }
        
        const result = await db.query(sql, params);
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
    },

    async assignBarber(id, barberId) {
        const result = await db.query(
            `UPDATE appointments SET barber_id = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [barberId, id]
        );
        return result.rows[0];
    }
};

const TransactionsRepo = {
    async getRecent(shopId = null, barberId = null, limit = 20) {
        let sql = 'SELECT t.*, b.name as barber_name FROM transactions t LEFT JOIN barbers b ON t.barber_id = b.id';
        const params = [];
        const conditions = [];
        
        if (shopId) {
            conditions.push(`t.shop_id = $${params.length + 1}`);
            params.push(shopId);
        }
        if (barberId) {
            conditions.push(`t.barber_id = $${params.length + 1}`);
            params.push(barberId);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ` ORDER BY t.occurred_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const result = await db.query(sql, params);
        return result.rows;
    },

    async create(transaction) {
        const result = await db.query(
            `INSERT INTO transactions (shop_id, barber_id, appointment_id, user_id, amount_cents, service_name, client_name, payment_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                transaction.shop_id, transaction.barber_id,
                transaction.appointment_id, transaction.user_id, transaction.amount_cents,
                transaction.service_name, transaction.client_name, transaction.payment_method || 'cash'
            ]
        );
        return result.rows[0];
    },

    async getWeeklyTotal(shopId = null, barberId = null) {
        let sql = `SELECT COALESCE(SUM(amount_cents), 0) as total 
             FROM transactions 
             WHERE occurred_at >= DATE_TRUNC('week', CURRENT_DATE)`;
        const params = [];
        
        if (shopId) {
            sql += ` AND shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        if (barberId) {
            sql += ` AND barber_id = $${params.length + 1}`;
            params.push(barberId);
        }
        
        const result = await db.query(sql, params);
        return parseInt(result.rows[0].total);
    },

    async getMonthlyTotal(shopId = null, barberId = null) {
        let sql = `SELECT COALESCE(SUM(amount_cents), 0) as total 
             FROM transactions 
             WHERE occurred_at >= DATE_TRUNC('month', CURRENT_DATE)`;
        const params = [];
        
        if (shopId) {
            sql += ` AND shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        if (barberId) {
            sql += ` AND barber_id = $${params.length + 1}`;
            params.push(barberId);
        }
        
        const result = await db.query(sql, params);
        return parseInt(result.rows[0].total);
    }
};

const MessagesRepo = {
    async getRecent(shopId = null, limit = 10) {
        let sql = `SELECT * FROM messages WHERE is_command = false`;
        const params = [];
        
        if (shopId) {
            sql += ` AND shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        sql += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const result = await db.query(sql, params);
        return result.rows;
    },

    async getNew(shopId = null) {
        let sql = `SELECT * FROM messages WHERE is_new = true AND is_command = false`;
        const params = [];
        
        if (shopId) {
            sql += ` AND shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        sql += ' ORDER BY sent_at DESC';
        
        const result = await db.query(sql, params);
        return result.rows;
    },

    async create(message) {
        const isCommand = message.text.startsWith('/');
        const result = await db.query(
            `INSERT INTO messages (shop_id, barber_id, user_id, chat_id, sender, text, is_command, is_new)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
            [message.shop_id, message.barber_id, message.user_id, message.chat_id, message.sender, message.text, isCommand]
        );
        return result.rows[0];
    },

    async markAsRead(id) {
        await db.query('UPDATE messages SET is_new = false WHERE id = $1', [id]);
    },

    async markAllAsRead(shopId = null) {
        if (shopId) {
            await db.query('UPDATE messages SET is_new = false WHERE is_new = true AND shop_id = $1', [shopId]);
        } else {
            await db.query('UPDATE messages SET is_new = false WHERE is_new = true');
        }
    }
};

const BudgetRepo = {
    async getTargets(shopId = null, barberId = null) {
        let sql = 'SELECT * FROM budget_targets';
        const params = [];
        const conditions = [];
        
        if (shopId) {
            conditions.push(`shop_id = $${params.length + 1}`);
            params.push(shopId);
        }
        if (barberId) {
            conditions.push(`barber_id = $${params.length + 1}`);
            params.push(barberId);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY period';
        
        const result = await db.query(sql, params);
        return result.rows;
    },

    async updateTarget(period, goalCents, shopId = null, barberId = null) {
        const result = await db.query(
            `UPDATE budget_targets SET goal_cents = $1 WHERE period = $2 
             AND shop_id IS NOT DISTINCT FROM $3 AND barber_id IS NOT DISTINCT FROM $4 RETURNING *`,
            [goalCents, period, shopId, barberId]
        );
        if (result.rows.length === 0) {
            return (await db.query(
                `INSERT INTO budget_targets (period, goal_cents, period_start, shop_id, barber_id) 
                 VALUES ($1, $2, CURRENT_DATE, $3, $4) RETURNING *`,
                [period, goalCents, shopId, barberId]
            )).rows[0];
        }
        return result.rows[0];
    },

    async getBudgetSummary(shopId = null, barberId = null) {
        const [weeklyTotal, monthlyTotal, targets] = await Promise.all([
            TransactionsRepo.getWeeklyTotal(shopId, barberId),
            TransactionsRepo.getMonthlyTotal(shopId, barberId),
            this.getTargets(shopId, barberId)
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
    async log(userId, userName, confidence, shopId = null, mirrorId = null) {
        const result = await db.query(
            `INSERT INTO recognition_events (user_id, user_name, confidence, shop_id, mirror_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, userName, confidence, shopId, mirrorId]
        );
        return result.rows[0];
    },

    async getRecent(shopId = null, limit = 20) {
        let sql = 'SELECT * FROM recognition_events';
        const params = [];
        
        if (shopId) {
            sql += ` WHERE shop_id = $${params.length + 1}`;
            params.push(shopId);
        }
        sql += ` ORDER BY detected_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const result = await db.query(sql, params);
        return result.rows;
    }
};

module.exports = {
    ShopsRepo,
    BarbersRepo,
    MirrorsRepo,
    WalkInQueueRepo,
    ServicesRepo,
    UsersRepo,
    AppointmentsRepo,
    TransactionsRepo,
    MessagesRepo,
    BudgetRepo,
    RecognitionRepo
};
