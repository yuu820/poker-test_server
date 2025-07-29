const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../database/db');
const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.get('SELECT value FROM settings WHERE key = ?', ['signup_bonus'], (err, setting) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const signupBonus = parseInt(setting.value);
      
      db.run(
        'INSERT INTO users (username, password, coins) VALUES (?, ?, ?)',
        [username, hashedPassword, signupBonus],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: 'Database error' });
          }
          
          const token = jwt.sign({ id: this.lastID, username }, process.env.JWT_SECRET);
          res.json({ token, username, coins: signupBonus });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = user.last_login ? user.last_login.split('T')[0] : null;
    let dailyBonus = 0;
    
    if (lastLogin !== today) {
      db.get('SELECT value FROM settings WHERE key = ?', ['daily_bonus'], (err, setting) => {
        if (!err && setting) {
          dailyBonus = parseInt(setting.value);
          const newCoins = user.coins + dailyBonus;
          
          db.run(
            'UPDATE users SET coins = ?, last_login = ? WHERE id = ?',
            [newCoins, new Date().toISOString(), user.id],
            (err) => {
              if (!err) {
                user.coins = newCoins;
              }
            }
          );
        }
        
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
        res.json({ 
          token, 
          username: user.username, 
          coins: user.coins, 
          dailyBonus 
        });
      });
    } else {
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
      res.json({ token, username: user.username, coins: user.coins, dailyBonus: 0 });
    }
  });
});

module.exports = router;