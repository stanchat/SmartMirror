const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');

const app = express();
const PORT = 5000;
const MM_PORT = 8080;

app.use(express.json());

const adminApi = require('./admin/api');
const authRoutes = require('./backend/auth/routes');

app.use('/api/auth', authRoutes);
app.use('/api', adminApi);

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/register/:shopSlug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

console.log('Starting Telegram Bot...');
const telegramBot = spawn('python', ['backend/telegram_bot.py'], {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit'
});

telegramBot.on('error', (err) => {
    console.error('Failed to start Telegram bot:', err);
});

telegramBot.on('exit', (code) => {
    if (code !== 0) {
        console.error('Telegram bot exited with code:', code);
    }
});

console.log('Starting MagicMirror on port', MM_PORT, '...');
const mm = spawn('npm', ['run', 'server', '--', '--port', MM_PORT.toString()], {
    cwd: __dirname,
    env: { ...process.env, MM_PORT: MM_PORT.toString() },
    stdio: 'inherit'
});

mm.on('error', (err) => {
    console.error('Failed to start MagicMirror:', err);
});

setTimeout(() => {
    app.use('/', createProxyMiddleware({
        target: `http://localhost:${MM_PORT}`,
        changeOrigin: true,
        ws: true
    }));

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SmartMirror server running on http://0.0.0.0:${PORT}`);
        console.log(`Admin panel available at http://0.0.0.0:${PORT}/admin`);
    });
}, 3000);

process.on('SIGTERM', () => {
    telegramBot.kill();
    mm.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    telegramBot.kill();
    mm.kill();
    process.exit(0);
});
