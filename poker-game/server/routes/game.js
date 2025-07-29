const express = require('express');
const db = require('../../database/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

function generateMatchCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

router.get('/user-info', authenticateToken, (req, res) => {
    db.get('SELECT coins FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ coins: user.coins });
    });
});

router.get('/messages', authenticateToken, (req, res) => {
    db.all('SELECT * FROM messages ORDER BY created_at DESC', (err, messages) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(messages || []);
    });
});

router.post('/claim-gift', authenticateToken, (req, res) => {
    const { messageId } = req.body;
    
    db.get('SELECT gift_coins FROM messages WHERE id = ?', [messageId], (err, message) => {
        if (err || !message) {
            return res.status(400).json({ error: 'Invalid message' });
        }
        
        db.run(
            'UPDATE users SET coins = coins + ? WHERE id = ?',
            [message.gift_coins, req.user.id],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ success: true });
            }
        );
    });
});

router.post('/create-match', authenticateToken, async (req, res) => {
    const { maxCoins, smallBlind, maxRounds, maxPlayers } = req.body;
    const code = generateMatchCode();
    const bigBlind = smallBlind * 2;
    
    // 管理画面の設定値を取得して検証
    db.all('SELECT key, value FROM settings', (err, settings) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        const settingsMap = {};
        settings.forEach(setting => {
            settingsMap[setting.key] = parseInt(setting.value);
        });
        
        // 設定値に対するバリデーション
        if (maxCoins < settingsMap.max_coins_min || maxCoins > settingsMap.max_coins_max) {
            return res.status(400).json({ error: `最大コイン数は${settingsMap.max_coins_min}から${settingsMap.max_coins_max}の範囲で設定してください` });
        }
        
        if (smallBlind < settingsMap.small_blind_min || smallBlind > settingsMap.small_blind_max) {
            return res.status(400).json({ error: `スモールブラインドは${settingsMap.small_blind_min}から${settingsMap.small_blind_max}の範囲で設定してください` });
        }
        
        if (maxRounds < settingsMap.rounds_min || maxRounds > settingsMap.rounds_max) {
            return res.status(400).json({ error: `ラウンド数は${settingsMap.rounds_min}から${settingsMap.rounds_max}の範囲で設定してください` });
        }
        
        if (maxCoins % settingsMap.max_coins_step !== 0) {
            return res.status(400).json({ error: `最大コイン数は${settingsMap.max_coins_step}の倍数で設定してください` });
        }
        
        if (smallBlind % settingsMap.small_blind_step !== 0) {
            return res.status(400).json({ error: `スモールブラインドは${settingsMap.small_blind_step}の倍数で設定してください` });
        }
        
        if (maxRounds % settingsMap.rounds_step !== 0) {
            return res.status(400).json({ error: `ラウンド数は${settingsMap.rounds_step}の倍数で設定してください` });
        }
    
        db.get('SELECT coins FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err || !user) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (user.coins < maxCoins) {
                return res.status(400).json({ error: 'コインが不足しています' });
            }
            
            db.run(
                `INSERT INTO matches (code, creator_id, max_coins, small_blind, big_blind, max_rounds, max_players) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [code, req.user.id, maxCoins, smallBlind, bigBlind, maxRounds, maxPlayers],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    const matchId = this.lastID;
                    db.run(
                        `INSERT INTO match_players (match_id, user_id, initial_coins, current_coins) 
                         VALUES (?, ?, ?, ?)`,
                        [matchId, req.user.id, maxCoins, maxCoins],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }
                            res.json({ code, matchId });
                        }
                    );
                }
            );
        });
    });
});

router.post('/join-match', authenticateToken, (req, res) => {
    const { code } = req.body;
    
    db.get(
        `SELECT m.*, COUNT(mp.id) as current_players 
         FROM matches m 
         LEFT JOIN match_players mp ON m.id = mp.match_id 
         WHERE m.code = ? AND m.status = 'waiting' 
         GROUP BY m.id`,
        [code],
        (err, match) => {
            if (err || !match) {
                return res.status(400).json({ error: '無効なコードです' });
            }
            
            if (match.current_players >= match.max_players) {
                return res.status(400).json({ error: 'マッチが満員です' });
            }
            
            // 同一プレイヤーの重複参加チェック
            db.get(
                'SELECT id FROM match_players WHERE match_id = ? AND user_id = ?',
                [match.id, req.user.id],
                (err, existingPlayer) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    if (existingPlayer) {
                        return res.status(400).json({ error: 'すでにこのマッチに参加しています' });
                    }
            
                    db.get('SELECT coins FROM users WHERE id = ?', [req.user.id], (err, user) => {
                        if (err || !user) {
                            return res.status(500).json({ error: 'Database error' });
                        }
                        
                        if (user.coins < match.max_coins) {
                            return res.status(400).json({ error: 'コインが不足しています' });
                        }
                        
                        db.run(
                            `INSERT INTO match_players (match_id, user_id, initial_coins, current_coins) 
                             VALUES (?, ?, ?, ?)`,
                            [match.id, req.user.id, match.max_coins, match.max_coins],
                            (err) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Database error' });
                                }
                                res.json({ success: true, matchId: match.id });
                            }
                        );
                    });
                }
            );
        }
    );
});

module.exports = router;