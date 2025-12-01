const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../backend/db');
const { ServicesRepo, UsersRepo, AppointmentsRepo, TransactionsRepo, MessagesRepo, BudgetRepo, ShopsRepo } = require('../backend/db/repositories');
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
