const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../database/db');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ admin: true }, process.env.JWT_SECRET);
        res.json({ success: true, token });
    } else {
        res.status(403).json({ error: '管理者認証に失敗しました' });
    }
});

router.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err || !decoded.admin) {
            return res.status(403).json({ error: 'Invalid admin token' });
        }
        next();
    });
});

router.get('/users', (req, res) => {
    const search = req.query.search;
    let query = 'SELECT id, username, coins, last_login, created_at FROM users';
    const params = [];
    
    if (search) {
        query += ' WHERE username LIKE ?';
        params.push(`%${search}%`);
    }
    
    db.all(query, params, (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(users);
    });
});

router.put('/users/:id/coins', (req, res) => {
    const { id } = req.params;
    const { coins } = req.body;
    
    db.run('UPDATE users SET coins = ? WHERE id = ?', [coins, id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

router.get('/settings', (req, res) => {
    db.all('SELECT * FROM settings', (err, settings) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(settings);
    });
});

router.put('/settings/:key', (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

router.post('/messages', (req, res) => {
    const { title, content, gift_coins } = req.body;
    
    db.run(
        'INSERT INTO messages (title, content, gift_coins) VALUES (?, ?, ?)',
        [title, content, gift_coins || 0],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        }
    );
});

router.get('/messages', (req, res) => {
    db.all('SELECT * FROM messages ORDER BY created_at DESC', (err, messages) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(messages);
    });
});

router.get('/database/:table', (req, res) => {
    const { table } = req.params;
    const allowedTables = ['users', 'matches', 'match_players', 'messages', 'settings'];
    
    if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table' });
    }
    
    db.all(`SELECT * FROM ${table}`, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(data);
    });
});

module.exports = router;