const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const dataFile = path.join(__dirname, '../backend/data.json');

function loadData() {
    try {
        if (fs.existsSync(dataFile)) {
            return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading data:', err);
    }
    return getDefaultData();
}

function saveData(data) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

function getDefaultData() {
    return {
        users: [],
        appointments: [],
        budget: {
            weekly_goal: 2000,
            monthly_goal: 8000,
            current_week_earned: 0,
            current_month_earned: 0,
            transactions: []
        },
        telegram_messages: [],
        recognition_log: []
    };
}

router.get('/budget', (req, res) => {
    const data = loadData();
    const budget = data.budget || getDefaultData().budget;
    
    const weeklyProgress = Math.round((budget.current_week_earned / budget.weekly_goal) * 1000) / 10;
    const monthlyProgress = Math.round((budget.current_month_earned / budget.monthly_goal) * 1000) / 10;
    
    res.json({
        success: true,
        budget: {
            weekly_goal: budget.weekly_goal,
            monthly_goal: budget.monthly_goal,
            current_week_earned: budget.current_week_earned,
            current_month_earned: budget.current_month_earned,
            weekly_remaining: budget.weekly_goal - budget.current_week_earned,
            monthly_remaining: budget.monthly_goal - budget.current_month_earned,
            weekly_progress: weeklyProgress,
            monthly_progress: monthlyProgress
        },
        recent_transactions: (budget.transactions || []).slice(-10).reverse()
    });
});

router.post('/budget/transaction', (req, res) => {
    const data = loadData();
    const { amount, service, client } = req.body;
    
    const transaction = {
        date: new Date().toISOString().split('T')[0],
        amount: parseFloat(amount) || 0,
        service: service || 'Service',
        client: client || 'Client'
    };
    
    data.budget = data.budget || getDefaultData().budget;
    data.budget.transactions = data.budget.transactions || [];
    data.budget.transactions.push(transaction);
    data.budget.current_week_earned += transaction.amount;
    data.budget.current_month_earned += transaction.amount;
    
    saveData(data);
    
    res.json({
        success: true,
        transaction: transaction,
        message: 'Earning added successfully'
    });
});

router.post('/budget/goals', (req, res) => {
    const data = loadData();
    const { weekly_goal, monthly_goal } = req.body;
    
    data.budget = data.budget || getDefaultData().budget;
    
    if (weekly_goal !== undefined) {
        data.budget.weekly_goal = parseFloat(weekly_goal);
    }
    if (monthly_goal !== undefined) {
        data.budget.monthly_goal = parseFloat(monthly_goal);
    }
    
    saveData(data);
    
    res.json({
        success: true,
        message: 'Goals updated successfully'
    });
});

router.get('/appointments', (req, res) => {
    const data = loadData();
    const appointments = data.appointments || [];
    
    res.json({
        success: true,
        appointments: appointments,
        count: appointments.length
    });
});

router.post('/appointments', (req, res) => {
    const data = loadData();
    const { user, service, time, date, barber } = req.body;
    
    const newAppointment = {
        id: Math.max(...(data.appointments || []).map(a => a.id), 0) + 1,
        user: user || 'Guest',
        service: service || 'Haircut',
        time: time || '12:00 PM',
        date: date || 'today',
        barber: barber || 'Available'
    };
    
    data.appointments = data.appointments || [];
    data.appointments.push(newAppointment);
    saveData(data);
    
    res.json({
        success: true,
        appointment: newAppointment
    });
});

router.get('/telegram/messages', (req, res) => {
    const data = loadData();
    const messages = data.telegram_messages || [];
    
    res.json({
        success: true,
        messages: messages.slice(0, 20)
    });
});

router.post('/telegram/send', (req, res) => {
    const data = loadData();
    const { sender, text } = req.body;
    
    const message = {
        id: Date.now(),
        sender: sender || 'Unknown',
        text: text || '',
        timestamp: new Date().toISOString(),
        isNew: true
    };
    
    data.telegram_messages = data.telegram_messages || [];
    data.telegram_messages.unshift(message);
    
    if (data.telegram_messages.length > 50) {
        data.telegram_messages = data.telegram_messages.slice(0, 50);
    }
    
    saveData(data);
    
    res.json({
        success: true,
        message: message
    });
});

router.post('/mirror/command', (req, res) => {
    const { command } = req.body;
    
    console.log('Mirror command received:', command);
    
    res.json({
        success: true,
        command: command,
        message: 'Command sent to mirror'
    });
});

router.get('/users', (req, res) => {
    const data = loadData();
    const users = data.users || [];
    
    res.json({
        success: true,
        users: users,
        count: users.length
    });
});

router.post('/users/register', (req, res) => {
    const data = loadData();
    const { name } = req.body;
    
    if (!name || !name.trim()) {
        return res.json({
            success: false,
            message: 'Please provide a customer name'
        });
    }
    
    const existingUser = (data.users || []).find(u => 
        u.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingUser) {
        return res.json({
            success: false,
            message: 'A customer with this name already exists'
        });
    }
    
    const pendingRegistration = {
        name: name.trim(),
        initiated_at: new Date().toISOString(),
        status: 'pending'
    };
    
    data.pending_registration = pendingRegistration;
    saveData(data);
    
    console.log('Registration initiated for:', name);
    
    res.json({
        success: true,
        message: 'Registration initiated. Mirror will capture face.',
        pending: pendingRegistration
    });
});

router.get('/users/pending', (req, res) => {
    const data = loadData();
    
    res.json({
        success: true,
        pending: data.pending_registration || null
    });
});

router.post('/users/complete', (req, res) => {
    const data = loadData();
    const { imageData, faceDescriptor } = req.body;
    
    const pending = data.pending_registration;
    if (!pending) {
        return res.json({
            success: false,
            message: 'No pending registration'
        });
    }
    
    data.users = data.users || [];
    const userId = Math.max(...data.users.map(u => u.id), 0) + 1;
    let faceImagePath = null;
    
    if (imageData && imageData.startsWith('data:image')) {
        try {
            const facesDir = path.join(__dirname, '../backend/faces');
            if (!fs.existsSync(facesDir)) {
                fs.mkdirSync(facesDir, { recursive: true });
            }
            
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const filename = `user_${userId}_${Date.now()}.jpg`;
            const filepath = path.join(facesDir, filename);
            
            fs.writeFileSync(filepath, imageBuffer);
            faceImagePath = `faces/${filename}`;
            console.log('Face image saved:', faceImagePath);
        } catch (err) {
            console.error('Error saving face image:', err);
        }
    }
    
    const newUser = {
        id: userId,
        name: pending.name,
        trained_at: new Date().toISOString().split('T')[0],
        recognition_count: 0,
        face_image: faceImagePath,
        face_descriptor: faceDescriptor || null,
        services: []
    };
    
    data.users.push(newUser);
    delete data.pending_registration;
    saveData(data);
    
    console.log('User registered with face descriptor:', !!faceDescriptor);
    
    res.json({
        success: true,
        user: newUser,
        message: 'Customer registered successfully'
    });
});

router.get('/users/:id/history', (req, res) => {
    const data = loadData();
    const userId = parseInt(req.params.id);
    
    const user = (data.users || []).find(u => u.id === userId);
    if (!user) {
        return res.json({
            success: false,
            message: 'User not found'
        });
    }
    
    const services = user.services || [];
    const lastService = services.length > 0 ? services[services.length - 1] : null;
    
    let recommendation = null;
    if (lastService) {
        recommendation = "Same as last time? " + lastService.service;
    } else {
        recommendation = "First visit! Ask about our popular services.";
    }
    
    res.json({
        success: true,
        visitCount: (user.recognition_count || 0) + 1,
        lastService: lastService,
        services: services,
        recommendation: recommendation
    });
});

router.post('/users/:id/recognized', (req, res) => {
    const data = loadData();
    const userId = parseInt(req.params.id);
    
    const user = (data.users || []).find(u => u.id === userId);
    if (!user) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    user.recognition_count = (user.recognition_count || 0) + 1;
    user.last_seen = new Date().toISOString();
    
    data.recognition_log = data.recognition_log || [];
    data.recognition_log.push({
        user_id: userId,
        user_name: user.name,
        timestamp: new Date().toISOString()
    });
    
    if (data.recognition_log.length > 100) {
        data.recognition_log = data.recognition_log.slice(-100);
    }
    
    saveData(data);
    
    res.json({
        success: true,
        recognition_count: user.recognition_count
    });
});

router.post('/users/:id/service', (req, res) => {
    const data = loadData();
    const userId = parseInt(req.params.id);
    const { service, notes, amount } = req.body;
    
    const user = (data.users || []).find(u => u.id === userId);
    if (!user) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    user.services = user.services || [];
    const serviceRecord = {
        id: Date.now(),
        service: service || 'Haircut',
        notes: notes || '',
        amount: parseFloat(amount) || 0,
        date: new Date().toISOString()
    };
    
    user.services.push(serviceRecord);
    saveData(data);
    
    res.json({
        success: true,
        service: serviceRecord,
        message: 'Service logged successfully'
    });
});

router.delete('/users/:id', (req, res) => {
    const data = loadData();
    const userId = parseInt(req.params.id);
    
    data.users = data.users || [];
    const userIndex = data.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return res.json({
            success: false,
            message: 'User not found'
        });
    }
    
    data.users.splice(userIndex, 1);
    saveData(data);
    
    res.json({
        success: true,
        message: 'User deleted successfully'
    });
});

const configFile = path.join(__dirname, '../config/config.js');

function getDefaultModuleConfig() {
    return {
        clock: {
            enabled: true,
            position: 'top_left',
            showDate: true,
            dateFormat: 'dddd, MMMM D, YYYY'
        },
        calendar: {
            enabled: true,
            position: 'top_left',
            calendarUrl: 'https://www.calendarlabs.com/ical-calendar/ics/76/US_Holidays.ics',
            calendarName: 'US Holidays',
            maxEntries: 5
        },
        weather: {
            enabled: true,
            position: 'top_right',
            showForecast: true,
            location: 'Chicago',
            lat: 41.8781,
            lon: -87.6298
        },
        faceRecognition: {
            enabled: true,
            position: 'middle_center',
            showVoiceInput: true,
            autoScan: false
        },
        telegram: {
            enabled: true,
            position: 'bottom_left',
            maxMessages: 4
        },
        appointments: {
            enabled: true,
            position: 'bottom_right',
            maxAppointments: 5,
            showAddButton: true
        },
        newsfeed: {
            enabled: true,
            position: 'bottom_bar',
            feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
            feedTitle: 'New York Times'
        }
    };
}

router.get('/modules', (req, res) => {
    const data = loadData();
    const defaults = getDefaultModuleConfig();
    const saved = data.moduleConfig || {};
    
    const moduleConfig = {};
    for (const key in defaults) {
        moduleConfig[key] = { ...defaults[key], ...saved[key] };
    }
    
    res.json({
        success: true,
        modules: moduleConfig,
        positions: [
            'top_bar', 'top_left', 'top_center', 'top_right',
            'upper_third', 'middle_center', 'lower_third',
            'bottom_left', 'bottom_center', 'bottom_right', 'bottom_bar'
        ]
    });
});

router.post('/modules', (req, res) => {
    const data = loadData();
    const { modules } = req.body;
    
    if (!modules) {
        return res.json({ success: false, message: 'No module configuration provided' });
    }
    
    data.moduleConfig = modules;
    saveData(data);
    
    generateConfigFile(modules);
    
    res.json({
        success: true,
        message: 'Module configuration saved. Refresh the mirror to apply changes.'
    });
});

function generateConfigFile(moduleConfig) {
    const modules = [];
    
    modules.push(`{
                        module: "alert",
                }`);
    
    if (moduleConfig.clock?.enabled) {
        modules.push(`{
                        module: "clock",
                        position: "${moduleConfig.clock.position || 'top_left'}",
                        config: {
                                showDate: ${moduleConfig.clock.showDate !== false},
                                showWeek: false,
                                dateFormat: "${moduleConfig.clock.dateFormat || 'dddd, MMMM D, YYYY'}"
                        }
                }`);
    }
    
    if (moduleConfig.calendar?.enabled) {
        modules.push(`{
                        module: "calendar",
                        header: "Upcoming Events",
                        position: "${moduleConfig.calendar.position || 'top_left'}",
                        config: {
                                calendars: [
                                        {
                                                symbol: "flag-usa",
                                                url: "${moduleConfig.calendar.calendarUrl || 'https://www.calendarlabs.com/ical-calendar/ics/76/US_Holidays.ics'}",
                                                name: "${moduleConfig.calendar.calendarName || 'US Holidays'}"
                                        }
                                ],
                                maximumEntries: ${moduleConfig.calendar.maxEntries || 5},
                                showLocation: false,
                                wrapEvents: true,
                                fetchInterval: 300000
                        }
                }`);
    }
    
    if (moduleConfig.faceRecognition?.enabled) {
        modules.push(`{
                        module: "MMM-Face-Recognition-SMAI",
                        position: "${moduleConfig.faceRecognition.position || 'middle_center'}",
                        config: {
                                showVoiceInput: ${moduleConfig.faceRecognition.showVoiceInput !== false},
                                autoScan: ${moduleConfig.faceRecognition.autoScan === true},
                                welcomeDuration: 6000,
                                animationSpeed: 500
                        }
                }`);
    }
    
    if (moduleConfig.weather?.enabled) {
        const lat = moduleConfig.weather.lat || 41.8781;
        const lon = moduleConfig.weather.lon || -87.6298;
        
        modules.push(`{
                        module: "weather",
                        position: "${moduleConfig.weather.position || 'top_right'}",
                        config: {
                                weatherProvider: "openmeteo",
                                type: "current",
                                lat: ${lat},
                                lon: ${lon}
                        }
                }`);
        
        if (moduleConfig.weather.showForecast !== false) {
            modules.push(`{
                        module: "weather",
                        position: "${moduleConfig.weather.position || 'top_right'}",
                        header: "Weather Forecast",
                        config: {
                                weatherProvider: "openmeteo",
                                type: "forecast",
                                maxNumberOfDays: 5,
                                lat: ${lat},
                                lon: ${lon}
                        }
                }`);
        }
    }
    
    if (moduleConfig.telegram?.enabled) {
        modules.push(`{
                        module: "MMM-TelegramRelayDisplay",
                        position: "${moduleConfig.telegram.position || 'bottom_left'}",
                        header: "",
                        config: {
                                maxMessages: ${moduleConfig.telegram.maxMessages || 4},
                                displayDuration: 10000,
                                updateInterval: 5000,
                                showTimestamp: true,
                                showSender: true
                        }
                }`);
    }
    
    if (moduleConfig.appointments?.enabled) {
        modules.push(`{
                        module: "MMM-Appointments",
                        position: "${moduleConfig.appointments.position || 'bottom_right'}",
                        header: "",
                        config: {
                                updateInterval: 60000,
                                maxAppointments: ${moduleConfig.appointments.maxAppointments || 5},
                                showAddButton: ${moduleConfig.appointments.showAddButton !== false}
                        }
                }`);
    }
    
    if (moduleConfig.newsfeed?.enabled) {
        modules.push(`{
                        module: "newsfeed",
                        position: "${moduleConfig.newsfeed.position || 'bottom_bar'}",
                        config: {
                                feeds: [
                                        {
                                                title: "${moduleConfig.newsfeed.feedTitle || 'New York Times'}",
                                                url: "${moduleConfig.newsfeed.feedUrl || 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'}"
                                        }
                                ],
                                showSourceTitle: true,
                                showPublishDate: true,
                                broadcastNewsFeeds: true,
                                broadcastNewsUpdates: true,
                                showDescription: false
                        }
                }`);
    }
    
    const configContent = `/* SmartMirror Configuration
 *
 * Full-featured SmartMirror with face recognition, voice commands,
 * calendar integration, Telegram messaging, and appointments.
 * Budget Tracker is available on the separate admin page at /admin
 *
 * This file is auto-generated by the admin panel.
 * Last updated: ${new Date().toISOString()}
 */
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
                ${modules.join(',\n\t\t')}
        ]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
`;
    
    try {
        fs.writeFileSync(configFile, configContent);
        console.log('Config file regenerated successfully');
    } catch (err) {
        console.error('Error writing config file:', err);
    }
}

module.exports = router;
