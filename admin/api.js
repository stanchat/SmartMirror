const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../backend/db');
const { ServicesRepo, UsersRepo, AppointmentsRepo, TransactionsRepo, MessagesRepo, BudgetRepo, ShopsRepo, WalkInQueueRepo, BarbersRepo, MirrorsRepo } = require('../backend/db/repositories');
const { authMiddleware, requireAdmin, ROLES } = require('../backend/auth/middleware');

const router = express.Router();

function getShopId(req) {
    const shopId = req.auth?.shop_id;
    if (!shopId) {
        throw new Error('Shop ID required');
    }
    return shopId;
}

function getBarberId(req) {
    return req.auth?.barber_id || null;
}

function isAdmin(req) {
    return req.auth?.role === ROLES.ADMIN;
}

function requireShopId(req, res, next) {
    if (!req.auth?.shop_id) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    next();
}

router.get('/health', async (req, res) => {
    const health = await db.healthCheck();
    res.json(health);
});

router.get('/budget', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const barberId = isAdmin(req) ? null : getBarberId(req);
        
        const [summary, transactions] = await Promise.all([
            BudgetRepo.getBudgetSummary(shopId, barberId),
            TransactionsRepo.getRecent(shopId, barberId, 10)
        ]);
        
        const weeklyProgress = Math.round((summary.current_week_earned / summary.weekly_goal) * 1000) / 10;
        const monthlyProgress = Math.round((summary.current_month_earned / summary.monthly_goal) * 1000) / 10;
        
        res.json({
            success: true,
            budget: {
                weekly_goal: summary.weekly_goal / 100,
                monthly_goal: summary.monthly_goal / 100,
                current_week_earned: summary.current_week_earned / 100,
                current_month_earned: summary.current_month_earned / 100,
                weekly_remaining: (summary.weekly_goal - summary.current_week_earned) / 100,
                monthly_remaining: (summary.monthly_goal - summary.current_month_earned) / 100,
                weekly_progress: weeklyProgress,
                monthly_progress: monthlyProgress
            },
            recent_transactions: transactions.map(t => ({
                date: t.occurred_at,
                amount: t.amount_cents / 100,
                service: t.service_name,
                client: t.client_name,
                barber: t.barber_name
            }))
        });
    } catch (err) {
        console.error('Budget error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/budget/transaction', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { amount, service, client } = req.body;
        const amountCents = Math.round(parseFloat(amount) * 100) || 0;
        const shopId = getShopId(req);
        const barberId = getBarberId(req);
        
        if (!barberId) {
            return res.status(400).json({ success: false, error: 'Barber ID required' });
        }
        
        const transaction = await TransactionsRepo.create({
            shop_id: shopId,
            barber_id: barberId,
            amount_cents: amountCents,
            service_name: service || 'Service',
            client_name: client || 'Client'
        });
        
        res.json({
            success: true,
            transaction: {
                date: transaction.occurred_at,
                amount: transaction.amount_cents / 100,
                service: transaction.service_name,
                client: transaction.client_name
            },
            message: 'Earning added successfully'
        });
    } catch (err) {
        console.error('Transaction error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/budget/goals', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { weekly_goal, monthly_goal } = req.body;
        const shopId = getShopId(req);
        
        if (weekly_goal !== undefined) {
            await BudgetRepo.updateTarget('weekly', Math.round(parseFloat(weekly_goal) * 100), shopId);
        }
        if (monthly_goal !== undefined) {
            await BudgetRepo.updateTarget('monthly', Math.round(parseFloat(monthly_goal) * 100), shopId);
        }
        
        res.json({
            success: true,
            message: 'Goals updated successfully'
        });
    } catch (err) {
        console.error('Goals error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/appointments', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { date } = req.query;
        const shopId = getShopId(req);
        const barberId = isAdmin(req) ? null : getBarberId(req);
        let appointments;
        
        if (date) {
            appointments = await AppointmentsRepo.getByDate(date, shopId, barberId);
        } else {
            appointments = await AppointmentsRepo.getAll(shopId, barberId);
        }
        
        const SLOT_TO_TIME = {
            'slot_0900': '9:00 AM', 'slot_1000': '10:00 AM', 'slot_1100': '11:00 AM',
            'slot_1200': '12:00 PM', 'slot_1300': '1:00 PM', 'slot_1400': '2:00 PM',
            'slot_1500': '3:00 PM', 'slot_1600': '4:00 PM', 'slot_1700': '5:00 PM'
        };
        
        res.json({
            success: true,
            appointments: appointments.map(a => ({
                id: a.id,
                user: a.client_name,
                client: a.client_name,
                service: a.service_name || 'Service',
                time: SLOT_TO_TIME[a.time_slot] || a.time_slot,
                date: a.appointment_date,
                barber: a.barber_name || a.barber,
                status: a.status
            })),
            count: appointments.length
        });
    } catch (err) {
        console.error('Appointments error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/appointments', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { user, service, time, date, barber } = req.body;
        const shopId = getShopId(req);
        
        const TIME_TO_SLOT = {
            '9:00 AM': 'slot_0900', '10:00 AM': 'slot_1000', '11:00 AM': 'slot_1100',
            '12:00 PM': 'slot_1200', '1:00 PM': 'slot_1300', '2:00 PM': 'slot_1400',
            '3:00 PM': 'slot_1500', '4:00 PM': 'slot_1600', '5:00 PM': 'slot_1700'
        };
        
        const serviceResult = await db.query('SELECT id FROM services WHERE LOWER(name) = LOWER($1) AND shop_id = $2', [service, shopId]);
        const serviceId = serviceResult.rows.length > 0 ? serviceResult.rows[0].id : null;
        
        const appointment = await AppointmentsRepo.create({
            shop_id: shopId,
            client_name: user,
            service_id: serviceId,
            appointment_date: date === 'today' ? new Date().toISOString().split('T')[0] : date,
            time_slot: TIME_TO_SLOT[time] || time,
            barber: barber || 'Any',
            booked_via: 'admin',
            booked_by: 'Admin'
        });
        
        res.json({
            success: true,
            appointment: appointment,
            message: 'Appointment booked successfully'
        });
    } catch (err) {
        console.error('Appointment create error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/appointments/:id', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const appointments = await AppointmentsRepo.getAll(shopId);
        const appt = appointments.find(a => a.id === parseInt(req.params.id));
        
        if (!appt) {
            return res.status(404).json({ success: false, error: 'Appointment not found' });
        }
        
        await AppointmentsRepo.cancel(parseInt(req.params.id));
        res.json({ success: true, message: 'Appointment cancelled' });
    } catch (err) {
        console.error('Appointment delete error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/services', authMiddleware, requireShopId, async (req, res) => {
    try {
        const activeOnly = req.query.all !== 'true';
        const shopId = getShopId(req);
        
        const services = await ServicesRepo.getAll(shopId, activeOnly);
        
        res.json({
            success: true,
            services: services.map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                duration: s.duration_minutes,
                price: s.price_cents / 100,
                is_active: s.is_active
            }))
        });
    } catch (err) {
        console.error('Services error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/services', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, description, duration, price } = req.body;
        const shopId = getShopId(req);
        
        const service = await ServicesRepo.create({
            shop_id: shopId,
            name: name,
            description: description || '',
            duration_minutes: parseInt(duration) || 30,
            price_cents: Math.round(parseFloat(price) * 100) || 0,
            is_active: true
        });
        
        res.json({
            success: true,
            service: {
                id: service.id,
                name: service.name,
                description: service.description,
                duration: service.duration_minutes,
                price: service.price_cents / 100,
                is_active: service.is_active
            },
            message: 'Service created successfully'
        });
    } catch (err) {
        console.error('Service create error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/services/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, description, duration, price, is_active } = req.body;
        const shopId = getShopId(req);
        
        const existingService = await ServicesRepo.getById(parseInt(req.params.id));
        if (!existingService || existingService.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        
        const service = await ServicesRepo.update(parseInt(req.params.id), {
            name: name,
            description: description || '',
            duration_minutes: parseInt(duration) || 30,
            price_cents: Math.round(parseFloat(price) * 100) || 0,
            is_active: is_active !== false
        });
        
        res.json({
            success: true,
            service: {
                id: service.id,
                name: service.name,
                description: service.description,
                duration: service.duration_minutes,
                price: service.price_cents / 100,
                is_active: service.is_active
            },
            message: 'Service updated successfully'
        });
    } catch (err) {
        console.error('Service update error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/services/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const existingService = await ServicesRepo.getById(parseInt(req.params.id));
        
        if (!existingService || existingService.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        
        await ServicesRepo.delete(parseInt(req.params.id));
        res.json({ success: true, message: 'Service deactivated' });
    } catch (err) {
        console.error('Service delete error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/users', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const users = await UsersRepo.getAll(shopId);
        
        res.json({
            success: true,
            users: users.map(u => ({
                id: u.id,
                name: u.name,
                recognition_count: u.recognition_count,
                last_seen: u.last_seen,
                has_face: !!u.face_descriptor,
                azure_person_id: u.azure_person_id,
                face_descriptor: u.face_descriptor
            }))
        });
    } catch (err) {
        console.error('Users error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/users', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { name, azure_person_id, face_descriptor } = req.body;
        const shopId = getShopId(req);
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }
        
        const user = await UsersRepo.create({
            shop_id: shopId,
            name: name,
            azure_person_id: azure_person_id || null,
            face_descriptor: face_descriptor || null
        });
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                recognition_count: user.recognition_count || 0,
                azure_person_id: user.azure_person_id,
                face_descriptor: user.face_descriptor
            },
            message: 'User registered successfully'
        });
    } catch (err) {
        console.error('User create error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/users/:id/recognition', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        await UsersRepo.incrementRecognition(userId);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Recognition log error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/users/pending', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const pending = await UsersRepo.getPending(shopId);
        res.json({ success: true, pending: pending });
    } catch (err) {
        console.error('Pending user error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/users/:id/face', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { face_descriptor } = req.body;
        
        if (!face_descriptor) {
            return res.status(400).json({ success: false, error: 'Face descriptor required' });
        }
        
        const user = await UsersRepo.completePending(userId, face_descriptor);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                has_face: !!user.face_descriptor
            },
            message: 'Face registered successfully'
        });
    } catch (err) {
        console.error('Face registration error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/telegram/messages', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const messages = await MessagesRepo.getRecent(shopId, 20);
        
        res.json({
            success: true,
            messages: messages.map(m => ({
                id: m.id,
                timestamp: m.sent_at,
                created_at: m.sent_at,
                sender: m.sender,
                text: m.text,
                content: m.text,
                isNew: m.is_new
            }))
        });
    } catch (err) {
        console.error('Messages error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/telegram/send', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { message } = req.body;
        const shopId = getShopId(req);
        const barberId = getBarberId(req);
        
        await MessagesRepo.create({
            shop_id: shopId,
            barber_id: barberId,
            sender: 'Admin',
            text: message,
            chat_id: 0
        });
        
        const logFile = path.join(__dirname, '../backend/telegram_log.json');
        let logs = [];
        try {
            if (fs.existsSync(logFile)) {
                logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
        } catch (e) {}
        
        logs.unshift({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            sender: 'Admin',
            text: message,
            isNew: true
        });
        logs = logs.slice(0, 100);
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        
        res.json({ success: true, message: 'Message sent to mirror' });
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/mirror/command', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { command } = req.body;
        const shopId = getShopId(req);
        const barberId = getBarberId(req);
        
        await MessagesRepo.create({
            shop_id: shopId,
            barber_id: barberId,
            sender: 'Admin',
            text: `[COMMAND] ${command}`,
            chat_id: 0
        });
        
        const logFile = path.join(__dirname, '../backend/telegram_log.json');
        let logs = [];
        try {
            if (fs.existsSync(logFile)) {
                logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
        } catch (e) {}
        
        logs.unshift({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            sender: 'Admin',
            text: `[COMMAND] ${command}`,
            isNew: true
        });
        logs = logs.slice(0, 100);
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        
        res.json({ success: true, message: `Command ${command} sent` });
    } catch (err) {
        console.error('Command error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/queue', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const statusFilter = req.query.status ? req.query.status.split(',') : ['waiting', 'called', 'in_service'];
        
        const queue = await WalkInQueueRepo.getByShop(shopId, statusFilter);
        
        res.json({
            success: true,
            queue: queue.map(q => ({
                id: q.id,
                position: q.queue_position,
                customer_name: q.customer_name,
                service: q.service_name,
                preferred_barber: q.preferred_barber_name,
                assigned_barber: q.assigned_barber_name,
                status: q.status,
                check_in_time: q.check_in_time,
                called_time: q.called_time,
                service_start_time: q.service_start_time,
                wait_time: q.check_in_time ? Math.round((Date.now() - new Date(q.check_in_time).getTime()) / 60000) : 0
            })),
            count: queue.length
        });
    } catch (err) {
        console.error('Queue error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/queue', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { customer_name, service_id, preferred_barber_id } = req.body;
        const shopId = getShopId(req);
        
        if (!customer_name) {
            return res.status(400).json({ success: false, error: 'Customer name is required' });
        }
        
        const entry = await WalkInQueueRepo.add({
            shop_id: shopId,
            customer_name: customer_name,
            service_id: service_id || null,
            preferred_barber_id: preferred_barber_id || null
        });
        
        res.json({
            success: true,
            entry: entry,
            message: `${customer_name} added to queue at position ${entry.queue_position}`
        });
    } catch (err) {
        console.error('Queue add error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/queue/:id/call', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const barberId = getBarberId(req);
        const { mirror_id } = req.body;
        
        const entry = await WalkInQueueRepo.callNext(shopId, barberId, mirror_id);
        
        if (!entry) {
            return res.status(404).json({ success: false, error: 'No customers waiting in queue' });
        }
        
        res.json({
            success: true,
            entry: entry,
            message: `Called ${entry.customer_name}`
        });
    } catch (err) {
        console.error('Queue call error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/queue/:id/start', authMiddleware, requireShopId, async (req, res) => {
    try {
        const entry = await WalkInQueueRepo.startService(parseInt(req.params.id));
        
        if (!entry) {
            return res.status(404).json({ success: false, error: 'Queue entry not found' });
        }
        
        res.json({
            success: true,
            entry: entry,
            message: 'Service started'
        });
    } catch (err) {
        console.error('Queue start error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/queue/:id/complete', authMiddleware, requireShopId, async (req, res) => {
    try {
        const entry = await WalkInQueueRepo.completeService(parseInt(req.params.id));
        
        if (!entry) {
            return res.status(404).json({ success: false, error: 'Queue entry not found' });
        }
        
        res.json({
            success: true,
            entry: entry,
            message: 'Service completed'
        });
    } catch (err) {
        console.error('Queue complete error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/queue/:id/noshow', authMiddleware, requireShopId, async (req, res) => {
    try {
        const entry = await WalkInQueueRepo.markNoShow(parseInt(req.params.id));
        
        if (!entry) {
            return res.status(404).json({ success: false, error: 'Queue entry not found' });
        }
        
        res.json({
            success: true,
            entry: entry,
            message: 'Marked as no-show'
        });
    } catch (err) {
        console.error('Queue no-show error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/barbers', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const includeInactive = req.query.all === 'true';
        
        const barbers = await BarbersRepo.getByShop(shopId, includeInactive);
        
        res.json({
            success: true,
            barbers: barbers.map(b => ({
                id: b.id,
                name: b.name,
                email: b.email,
                phone: b.phone,
                role: b.role,
                color: b.color,
                is_active: b.is_active,
                last_clock_in: b.last_clock_in,
                has_face: !!b.face_descriptor
            }))
        });
    } catch (err) {
        console.error('Barbers error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/barbers', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, pin_code, role, color } = req.body;
        const shopId = getShopId(req);
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }
        
        const barber = await BarbersRepo.create({
            shop_id: shopId,
            name: name,
            email: email || null,
            phone: phone || null,
            pin_code: pin_code || null,
            role: role || 'barber',
            color: color || '#3498db'
        });
        
        res.json({
            success: true,
            barber: barber,
            message: 'Barber created successfully'
        });
    } catch (err) {
        console.error('Barber create error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/barbers/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, pin_code, role, color, is_active } = req.body;
        const shopId = getShopId(req);
        
        const existingBarber = await BarbersRepo.getById(parseInt(req.params.id));
        if (!existingBarber || existingBarber.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Barber not found' });
        }
        
        const barber = await BarbersRepo.update(parseInt(req.params.id), {
            name, email, phone, pin_code, role, color, is_active
        });
        
        res.json({
            success: true,
            barber: barber,
            message: 'Barber updated successfully'
        });
    } catch (err) {
        console.error('Barber update error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/barbers/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const existingBarber = await BarbersRepo.getById(parseInt(req.params.id));
        
        if (!existingBarber || existingBarber.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Barber not found' });
        }
        
        await BarbersRepo.delete(parseInt(req.params.id));
        res.json({ success: true, message: 'Barber deactivated' });
    } catch (err) {
        console.error('Barber delete error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/barbers/clock-in', authMiddleware, requireShopId, async (req, res) => {
    try {
        const { mirror_id, pin_code, face_descriptor } = req.body;
        const shopId = getShopId(req);
        
        let barber = null;
        
        if (pin_code) {
            barber = await BarbersRepo.getByPinCode(shopId, pin_code);
        } else if (face_descriptor && Array.isArray(face_descriptor)) {
            const barbers = await BarbersRepo.getByShop(shopId);
            const threshold = 0.5;
            
            for (const b of barbers) {
                if (b.face_descriptor) {
                    let storedDescriptor = b.face_descriptor;
                    if (typeof storedDescriptor === 'string') {
                        storedDescriptor = JSON.parse(storedDescriptor);
                    }
                    
                    let distance = 0;
                    for (let i = 0; i < face_descriptor.length; i++) {
                        distance += Math.pow(face_descriptor[i] - storedDescriptor[i], 2);
                    }
                    distance = Math.sqrt(distance);
                    
                    if (distance < threshold) {
                        barber = b;
                        break;
                    }
                }
            }
        }
        
        if (!barber) {
            return res.status(401).json({ success: false, error: 'Invalid PIN or face not recognized' });
        }
        
        const existingSession = await BarbersRepo.getActiveSession(barber.id);
        if (existingSession) {
            return res.status(400).json({ 
                success: false, 
                error: `Already clocked in at ${existingSession.mirror_label}` 
            });
        }
        
        let mirrorId = mirror_id;
        if (!mirrorId) {
            const mirrors = await MirrorsRepo.getByShop(shopId);
            if (mirrors.length > 0) {
                mirrorId = mirrors[0].id;
            }
        }
        
        if (!mirrorId) {
            return res.status(400).json({ success: false, error: 'No mirror available for clock-in' });
        }
        
        const session = await BarbersRepo.clockIn(barber.id, mirrorId);
        
        res.json({
            success: true,
            barber: { id: barber.id, name: barber.name, role: barber.role },
            session: session,
            message: `${barber.name} clocked in successfully`
        });
    } catch (err) {
        console.error('Clock-in error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/barbers/clock-out', authMiddleware, requireShopId, async (req, res) => {
    try {
        const barberId = getBarberId(req);
        
        if (!barberId) {
            return res.status(400).json({ success: false, error: 'Barber ID required' });
        }
        
        const session = await BarbersRepo.clockOut(barberId);
        
        if (!session) {
            return res.status(400).json({ success: false, error: 'No active session to clock out' });
        }
        
        res.json({
            success: true,
            session: session,
            message: 'Clocked out successfully'
        });
    } catch (err) {
        console.error('Clock-out error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/barbers/session', authMiddleware, requireShopId, async (req, res) => {
    try {
        const barberId = getBarberId(req);
        
        if (!barberId) {
            return res.json({ success: true, session: null });
        }
        
        const session = await BarbersRepo.getActiveSession(barberId);
        
        res.json({
            success: true,
            session: session || null
        });
    } catch (err) {
        console.error('Session check error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/barbers/:id/face', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { face_descriptor } = req.body;
        const shopId = getShopId(req);
        
        const existingBarber = await BarbersRepo.getById(parseInt(req.params.id));
        if (!existingBarber || existingBarber.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Barber not found' });
        }
        
        if (!face_descriptor) {
            return res.status(400).json({ success: false, error: 'Face descriptor required' });
        }
        
        const barber = await BarbersRepo.update(parseInt(req.params.id), {
            face_descriptor: face_descriptor
        });
        
        res.json({
            success: true,
            barber: { id: barber.id, name: barber.name, has_face: !!barber.face_descriptor },
            message: 'Face registered for barber'
        });
    } catch (err) {
        console.error('Barber face registration error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/mirrors', authMiddleware, requireShopId, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const mirrors = await MirrorsRepo.getByShop(shopId);
        
        res.json({
            success: true,
            mirrors: mirrors.map(m => ({
                id: m.id,
                label: m.label,
                device_uid: m.device_uid,
                status: m.status,
                last_seen: m.last_seen,
                is_active: m.is_active,
                registration_code: m.registration_code,
                registration_expires: m.registration_expires
            }))
        });
    } catch (err) {
        console.error('Mirrors error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/mirrors', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { label } = req.body;
        const shopId = getShopId(req);
        
        if (!label) {
            return res.status(400).json({ success: false, error: 'Label is required' });
        }
        
        const mirror = await MirrorsRepo.create({
            shop_id: shopId,
            label: label
        });
        
        res.json({
            success: true,
            mirror: mirror,
            message: 'Mirror created successfully'
        });
    } catch (err) {
        console.error('Mirror create error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/mirrors/:id/register-code', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const mirror = await MirrorsRepo.getById(parseInt(req.params.id));
        
        if (!mirror || mirror.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Mirror not found' });
        }
        
        const updated = await MirrorsRepo.generateRegistrationCode(parseInt(req.params.id));
        
        res.json({
            success: true,
            mirror: updated,
            message: `Registration code: ${updated.registration_code} (valid for 24 hours)`
        });
    } catch (err) {
        console.error('Registration code error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/mirrors/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const shopId = getShopId(req);
        const mirror = await MirrorsRepo.getById(parseInt(req.params.id));
        
        if (!mirror || mirror.shop_id !== shopId) {
            return res.status(404).json({ success: false, error: 'Mirror not found' });
        }
        
        await MirrorsRepo.delete(parseInt(req.params.id));
        
        res.json({
            success: true,
            message: 'Mirror deleted successfully'
        });
    } catch (err) {
        console.error('Mirror delete error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, '../config/config.js');
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        res.json({ success: true, config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/modules', (req, res) => {
    try {
        const configPath = path.join(__dirname, '../config/config.js');
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        
        const modules = {};
        for (const mod of config.modules || []) {
            const key = mod.module.replace('MMM-', '').replace(/-/g, '_').toLowerCase();
            const moduleName = mod.module;
            
            let moduleKey;
            switch(moduleName) {
                case 'clock': moduleKey = 'clock'; break;
                case 'calendar': moduleKey = 'calendar'; break;
                case 'weather': moduleKey = 'weather'; break;
                case 'newsfeed': moduleKey = 'newsfeed'; break;
                case 'MMM-Face-Recognition-SMAI': moduleKey = 'faceRecognition'; break;
                case 'MMM-TelegramRelayDisplay': moduleKey = 'telegram'; break;
                case 'MMM-Appointments': moduleKey = 'appointments'; break;
                default: moduleKey = key;
            }
            
            modules[moduleKey] = {
                enabled: true,
                position: mod.position || 'top_left',
                ...mod.config
            };
        }
        
        res.json({ success: true, modules });
    } catch (err) {
        console.error('Modules GET error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/modules', authMiddleware, requireAdmin, (req, res) => {
    try {
        const { modules } = req.body;
        const configPath = path.join(__dirname, '../config/config.js');
        
        const moduleMapping = {
            clock: 'clock',
            calendar: 'calendar',
            weather: 'weather',
            newsfeed: 'newsfeed',
            faceRecognition: 'MMM-Face-Recognition-SMAI',
            telegram: 'MMM-TelegramRelayDisplay',
            appointments: 'MMM-Appointments'
        };
        
        const configModules = [];
        
        configModules.push({ module: 'alert', position: 'top_bar' });
        
        for (const [key, config] of Object.entries(modules)) {
            if (!config.enabled) continue;
            
            const moduleName = moduleMapping[key] || key;
            const mod = {
                module: moduleName,
                position: config.position || 'top_left'
            };
            
            const moduleConfig = { ...config };
            delete moduleConfig.enabled;
            delete moduleConfig.position;
            
            if (Object.keys(moduleConfig).length > 0) {
                mod.config = moduleConfig;
            }
            
            configModules.push(mod);
        }
        
        let configContent = `/* SmartMirror Configuration - Auto-generated */
let config = {
    address: "0.0.0.0",
    port: 8080,
    basePath: "/",
    ipWhitelist: [],
    useHttps: false,
    httpsPrivateKey: "",
    httpsCertificate: "",
    language: "en",
    locale: "en-US",
    logLevel: ["INFO", "LOG", "WARN", "ERROR"],
    timeFormat: 12,
    units: "imperial",
    modules: [
`;
        
        for (const mod of configModules) {
            configContent += `        {\n`;
            configContent += `            module: "${mod.module}",\n`;
            if (mod.position) configContent += `            position: "${mod.position}",\n`;
            if (mod.config) {
                configContent += `            config: ${JSON.stringify(mod.config, null, 16).replace(/\n/g, '\n            ')}\n`;
            }
            configContent += `        },\n`;
        }
        
        configContent += `    ]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
`;
        
        fs.writeFileSync(configPath, configContent);
        res.json({ success: true, message: 'Module configuration saved' });
    } catch (err) {
        console.error('Modules POST error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/config', authMiddleware, requireAdmin, (req, res) => {
    try {
        const { modules } = req.body;
        const configPath = path.join(__dirname, '../config/config.js');
        
        let configContent = `/* SmartMirror Configuration - Auto-generated */
let config = {
    address: "0.0.0.0",
    port: 8080,
    basePath: "/",
    ipWhitelist: [],
    useHttps: false,
    httpsPrivateKey: "",
    httpsCertificate: "",
    language: "en",
    locale: "en-US",
    logLevel: ["INFO", "LOG", "WARN", "ERROR"],
    timeFormat: 12,
    units: "imperial",
    modules: [
`;
        
        for (const mod of modules) {
            configContent += `        {\n`;
            configContent += `            module: "${mod.module}",\n`;
            if (mod.position) configContent += `            position: "${mod.position}",\n`;
            if (mod.header !== undefined) configContent += `            header: "${mod.header}",\n`;
            if (mod.config) {
                configContent += `            config: ${JSON.stringify(mod.config, null, 16).replace(/\n/g, '\n            ')}\n`;
            }
            configContent += `        },\n`;
        }
        
        configContent += `    ]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
`;
        
        fs.writeFileSync(configPath, configContent);
        res.json({ success: true, message: 'Configuration saved' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
