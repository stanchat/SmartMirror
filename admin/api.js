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

module.exports = router;
