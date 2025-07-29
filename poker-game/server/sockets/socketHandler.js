const jwt = require('jsonwebtoken');
const db = require('../../database/db');
const PokerGame = require('../game/poker');

const matches = new Map();
const userSockets = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
        
        socket.on('join-match', async (data) => {
            const { code, token } = data;
            
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decoded.id;
                const username = decoded.username;
                
                userSockets.set(username, socket.id);
                
                db.get(
                    `SELECT m.*, mp.current_coins 
                     FROM matches m 
                     JOIN match_players mp ON m.id = mp.match_id 
                     WHERE m.code = ? AND mp.user_id = ?`,
                    [code, userId],
                    (err, matchData) => {
                        if (err || !matchData) {
                            socket.emit('error', { 
                                message: '無効なマッチコードです', 
                                redirect: true 
                            });
                            return;
                        }
                        
                        socket.join(`match-${code}`);
                        
                        if (!matches.has(code)) {
                            const game = new PokerGame({
                                id: matchData.id,
                                maxPlayers: matchData.max_players,
                                smallBlind: matchData.small_blind,
                                bigBlind: matchData.big_blind,
                                maxRounds: matchData.max_rounds
                            });
                            matches.set(code, { game, matchData });
                        }
                        
                        const { game } = matches.get(code);
                        game.addPlayer({
                            id: userId,
                            username: username,
                            chips: matchData.current_coins
                        });
                        
                        updateMatchRoom(code);
                    }
                );
            } catch (error) {
                socket.emit('error', { 
                    message: '認証エラー', 
                    redirect: true 
                });
            }
        });
        
        socket.on('start-match', (data) => {
            const { code } = data;
            const match = matches.get(code);
            
            if (!match) return;
            
            const { game, matchData } = match;
            
            if (game.players.length >= 2) {
                db.run(
                    'UPDATE matches SET status = ? WHERE id = ?',
                    ['playing', matchData.id],
                    (err) => {
                        if (!err) {
                            game.startRound();
                            io.to(`match-${code}`).emit('match-started');
                            updateGameState(code);
                        }
                    }
                );
            }
        });
        
        socket.on('leave-match', (data) => {
            const { code } = data;
            const username = getUsernameBySocket(socket.id);
            
            if (!username) return;
            
            const match = matches.get(code);
            if (match) {
                match.game.removePlayer(username);
                socket.leave(`match-${code}`);
                updateMatchRoom(code);
                
                if (match.game.players.length === 0) {
                    matches.delete(code);
                }
            }
        });
        
        socket.on('player-action', (data) => {
            const { code, action, amount } = data;
            const username = getUsernameBySocket(socket.id);
            
            if (!username) return;
            
            const match = matches.get(code);
            if (match) {
                const { game } = match;
                if (game.playerAction(username, action, amount)) {
                    updateGameState(code);
                }
            }
        });
        
        socket.on('get-match-results', (data) => {
            const { code } = data;
            const username = getUsernameBySocket(socket.id);
            
            if (!username) return;
            
            db.all(
                `SELECT u.username, mp.final_coins as coins
                 FROM match_players mp
                 JOIN users u ON mp.user_id = u.id
                 JOIN matches m ON mp.match_id = m.id
                 WHERE m.code = ?
                 ORDER BY mp.final_coins DESC`,
                [code],
                (err, results) => {
                    if (!err && results.length > 0) {
                        const userResult = results.find(r => r.username === username);
                        const finalCoins = userResult ? userResult.coins : 0;
                        
                        socket.emit('match-finished', {
                            finalCoins: finalCoins,
                            ranking: results
                        });
                    }
                }
            );
        });
        
        socket.on('disconnect', () => {
            const username = getUsernameBySocket(socket.id);
            if (username) {
                userSockets.delete(username);
            }
            console.log('Client disconnected:', socket.id);
        });
    });
    
    function updateMatchRoom(code) {
        const match = matches.get(code);
        if (!match) return;
        
        const { game, matchData } = match;
        
        db.all(
            `SELECT u.username, mp.user_id = ? as isCreator 
             FROM match_players mp 
             JOIN users u ON mp.user_id = u.id 
             WHERE mp.match_id = ?`,
            [matchData.creator_id, matchData.id],
            (err, players) => {
                if (!err) {
                    const data = {
                        players: players.map(p => ({
                            username: p.username,
                            isCreator: p.isCreator === 1
                        })),
                        maxPlayers: matchData.max_players,
                        maxCoins: matchData.max_coins,
                        smallBlind: matchData.small_blind,
                        bigBlind: matchData.big_blind,
                        maxRounds: matchData.max_rounds
                    };
                    
                    io.to(`match-${code}`).emit('match-update', data);
                }
            }
        );
    }
    
    function updateGameState(code) {
        const match = matches.get(code);
        if (!match) return;
        
        const { game } = match;
        
        game.players.forEach(player => {
            const socketId = userSockets.get(player.username);
            if (socketId) {
                const gameState = game.getGameState(player.username);
                io.to(socketId).emit('game-update', gameState);
            }
        });
        
        if (game.phase === 'finished') {
            endMatch(code);
        } else if (game.phase === 'waiting' && game.currentRound > 1) {
            // 次のラウンドを自動的に開始
            setTimeout(() => {
                game.startRound();
                updateGameState(code);
            }, 3000); // 3秒後に次のラウンドを開始
        }
    }
    
    function endMatch(code) {
        const match = matches.get(code);
        if (!match) return;
        
        const { game, matchData } = match;
        
        db.run(
            'UPDATE matches SET status = ? WHERE id = ?',
            ['finished', matchData.id],
            (err) => {
                if (!err) {
                    game.players.forEach(player => {
                        db.run(
                            'UPDATE users SET coins = coins + ? WHERE id = ?',
                            [player.chips - matchData.max_coins, player.id]
                        );
                        
                        db.run(
                            'UPDATE match_players SET final_coins = ? WHERE match_id = ? AND user_id = ?',
                            [player.chips, matchData.id, player.id]
                        );
                    });
                    
                    setTimeout(() => {
                        db.all(
                            `SELECT u.username, mp.final_coins as coins
                             FROM match_players mp
                             JOIN users u ON mp.user_id = u.id
                             WHERE mp.match_id = ?
                             ORDER BY mp.final_coins DESC`,
                            [matchData.id],
                            (err, results) => {
                                if (!err) {
                                    game.players.forEach(player => {
                                        const socketId = userSockets.get(player.username);
                                        if (socketId) {
                                            const userResult = results.find(r => r.username === player.username);
                                            const finalCoins = userResult ? userResult.coins : player.chips;
                                            
                                            io.to(socketId).emit('match-finished', {
                                                finalCoins: finalCoins,
                                                ranking: results
                                            });
                                        }
                                    });
                                }
                            }
                        );
                    }, 500);
                    
                    matches.delete(code);
                }
            }
        );
    }
    
    function getUsernameBySocket(socketId) {
        for (const [username, id] of userSockets.entries()) {
            if (id === socketId) return username;
        }
        return null;
    }
};