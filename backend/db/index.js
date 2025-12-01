const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.log('Slow query:', { text, duration, rows: res.rowCount });
        }
        return res;
    } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
    }
}

async function getClient() {
    return pool.connect();
}

async function initDatabase() {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Database schema initialized successfully');
        return true;
    } catch (err) {
        console.error('Failed to initialize database:', err.message);
        return false;
    }
}

async function healthCheck() {
    try {
        const result = await pool.query('SELECT NOW()');
        return { healthy: true, timestamp: result.rows[0].now };
    } catch (err) {
        return { healthy: false, error: err.message };
    }
}

module.exports = {
    pool,
    query,
    getClient,
    initDatabase,
    healthCheck
};
