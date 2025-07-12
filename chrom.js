// server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./productivity.db');

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        time_spent INTEGER NOT NULL,
        category TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS daily_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        productive_time INTEGER DEFAULT 0,
        unproductive_time INTEGER DEFAULT 0,
        neutral_time INTEGER DEFAULT 0,
        total_time INTEGER DEFAULT 0
    )`);
});

// API Routes

// Add time entry
app.post('/api/time-entry', (req, res) => {
    const { domain, timeSpent, category, timestamp, date } = req.body;
    
    db.run(
        'INSERT INTO time_entries (domain, time_spent, category, timestamp, date) VALUES (?, ?, ?, ?, ?)',
        [domain, timeSpent, category, timestamp, date],
        function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Update daily summary
            updateDailySummary(date);
            res.json({ id: this.lastID });
        }
    );
});

// Get daily stats
app.get('/api/daily-stats/:date', (req, res) => {
    const date = req.params.date;
    
    db.get(
        'SELECT * FROM daily_summaries WHERE date = ?',
        [date],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(row || { 
                productive_time: 0, 
                unproductive_time: 0, 
                neutral_time: 0, 
                total_time: 0 
            });
        }
    );
});

// Get weekly stats
app.get('/api/weekly-stats', (req, res) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    db.all(
        'SELECT * FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date',
        [startDate.toDateString(), endDate.toDateString()],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Get top domains for a date range
app.get('/api/top-domains', (req, res) => {
    const { days = 7 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    db.all(
        `SELECT domain, SUM(time_spent) as total_time, category 
         FROM time_entries 
         WHERE date >= ? AND date <= ? 
         GROUP BY domain, category 
         ORDER BY total_time DESC 
         LIMIT 20`,
        [startDate.toDateString(), endDate.toDateString()],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Get productivity trend
app.get('/api/productivity-trend', (req, res) => {
    const { days = 30 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    db.all(
        `SELECT date, 
                SUM(CASE WHEN category = 'productive' THEN time_spent ELSE 0 END) as productive,
                SUM(CASE WHEN category = 'unproductive' THEN time_spent ELSE 0 END) as unproductive,
                SUM(CASE WHEN category = 'neutral' THEN time_spent ELSE 0 END) as neutral
         FROM time_entries 
         WHERE date >= ? AND date <= ? 
         GROUP BY date 
         ORDER BY date`,
        [startDate.toDateString(), endDate.toDateString()],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Helper function to update daily summary
function updateDailySummary(date) {
    db.all(
        'SELECT category, SUM(time_spent) as total FROM time_entries WHERE date = ? GROUP BY category',
        [date],
        (err, rows) => {
            if (err) return;
            
            const summary = {
                productive_time: 0,
                unproductive_time: 0,
                neutral_time: 0,
                total_time: 0
            };
            
            rows.forEach(row => {
                summary[`${row.category}_time`] = row.total;
                summary.total_time += row.total;
            });
            
            db.run(
                `INSERT OR REPLACE INTO daily_summaries 
                 (date, productive_time, unproductive_time, neutral_time, total_time) 
                 VALUES (?, ?, ?, ?, ?)`,
                [date, summary.productive_time, summary.unproductive_time, 
                 summary.neutral_time, summary.total_time]
            );
        }
    );
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});




