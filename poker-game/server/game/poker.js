class Card {
    constructor(suit, rank, value) {
        this.suit = suit;
        this.rank = rank;
        this.value = value;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }
    
    reset() {
        this.cards = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = [
            { rank: 'A', value: 14 },
            { rank: '2', value: 2 },
            { rank: '3', value: 3 },
            { rank: '4', value: 4 },
            { rank: '5', value: 5 },
            { rank: '6', value: 6 },
            { rank: '7', value: 7 },
            { rank: '8', value: 8 },
            { rank: '9', value: 9 },
            { rank: '10', value: 10 },
            { rank: 'J', value: 11 },
            { rank: 'Q', value: 12 },
            { rank: 'K', value: 13 }
        ];
        
        for (const suit of suits) {
            for (const rankInfo of ranks) {
                this.cards.push(new Card(suit, rankInfo.rank, rankInfo.value));
            }
        }
        
        this.shuffle();
    }
    
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    
    draw() {
        return this.cards.pop();
    }
}

class PokerGame {
    constructor(matchData) {
        this.matchId = matchData.id;
        this.players = [];
        this.maxPlayers = matchData.maxPlayers;
        this.smallBlind = matchData.smallBlind;
        this.bigBlind = matchData.bigBlind;
        this.maxRounds = matchData.maxRounds;
        this.currentRound = 1;
        this.deck = new Deck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.dealerIndex = 0;
        this.phase = 'waiting'; // waiting, preflop, flop, turn, river, showdown
        this.playerHands = new Map();
        this.playerBets = new Map();
        this.foldedPlayers = new Set();
        this.playerActions = new Map(); // プレイヤーのアクション履歴
    }
    
    addPlayer(player) {
        if (this.players.length < this.maxPlayers) {
            this.players.push({
                id: player.id,
                username: player.username,
                chips: player.chips,
                position: this.players.length
            });
            return true;
        }
        return false;
    }
    
    removePlayer(username) {
        this.players = this.players.filter(p => p.username !== username);
    }
    
    startRound() {
        console.log('Starting round', this.currentRound);
        this.deck.reset();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.playerHands.clear();
        this.playerBets.clear();
        this.foldedPlayers.clear();
        this.playerActions.clear();
        this.phase = 'preflop';
        
        this.dealCards();
        this.setupBlinds();
        
        // 2人プレイの場合は特別な処理
        if (this.players.length === 2) {
            // ディーラーがスモールブラインド、相手がビッグブラインド
            // ディーラーが最初にアクション
            this.currentPlayerIndex = this.dealerIndex;
        } else {
            // 3人以上の場合はビッグブラインドの次のプレイヤーから
            this.currentPlayerIndex = (this.dealerIndex + 3) % this.players.length;
        }
        
        console.log('Round started. Phase:', this.phase, 'Current player index:', this.currentPlayerIndex);
    }
    
    dealCards() {
        for (const player of this.players) {
            const hand = [this.deck.draw(), this.deck.draw()];
            this.playerHands.set(player.username, hand);
        }
    }
    
    setupBlinds() {
        let smallBlindIndex, bigBlindIndex;
        
        if (this.players.length === 2) {
            // 2人プレイの場合：ディーラーがスモールブラインド
            smallBlindIndex = this.dealerIndex;
            bigBlindIndex = (this.dealerIndex + 1) % this.players.length;
        } else {
            // 3人以上の場合：ディーラーの次がスモールブラインド
            smallBlindIndex = (this.dealerIndex + 1) % this.players.length;
            bigBlindIndex = (this.dealerIndex + 2) % this.players.length;
        }
        
        console.log(`Setting up blinds - Small: ${this.players[smallBlindIndex].username}, Big: ${this.players[bigBlindIndex].username}`);
        
        this.makeBet(this.players[smallBlindIndex].username, this.smallBlind);
        this.makeBet(this.players[bigBlindIndex].username, this.bigBlind);
        this.currentBet = this.bigBlind;
        
        // ブラインドベットのアクションを記録
        this.playerActions.set(this.players[smallBlindIndex].username, 'small_blind');
        this.playerActions.set(this.players[bigBlindIndex].username, 'big_blind');
    }
    
    makeBet(username, amount) {
        const player = this.players.find(p => p.username === username);
        if (!player) return false;
        
        const betAmount = Math.min(amount, player.chips);
        player.chips -= betAmount;
        this.pot += betAmount;
        
        const currentPlayerBet = this.playerBets.get(username) || 0;
        this.playerBets.set(username, currentPlayerBet + betAmount);
        
        return true;
    }
    
    playerAction(username, action, amount = 0) {
        const player = this.players[this.currentPlayerIndex];
        if (player.username !== username) return false;
        
        // アクションを記録
        this.playerActions.set(username, action);
        
        switch (action) {
            case 'fold':
                this.foldedPlayers.add(username);
                break;
                
            case 'check':
                const playerBet = this.playerBets.get(username) || 0;
                if (playerBet < this.currentBet) return false;
                break;
                
            case 'call':
                const callAmount = this.currentBet - (this.playerBets.get(username) || 0);
                this.makeBet(username, callAmount);
                break;
                
            case 'bet':
                const betAmount = parseInt(amount);
                if (betAmount <= 0 || this.currentBet > 0) return false;
                const totalBetAmount = betAmount - (this.playerBets.get(username) || 0);
                this.makeBet(username, totalBetAmount);
                this.currentBet = betAmount;
                // ベットがあった場合、他のプレイヤーのアクション履歴をクリア
                this.playerActions.clear();
                this.playerActions.set(username, action);
                break;
                
            case 'raise':
                const raiseAmount = parseInt(amount);
                if (raiseAmount <= this.currentBet) return false;
                const totalRaiseBet = raiseAmount - (this.playerBets.get(username) || 0);
                this.makeBet(username, totalRaiseBet);
                this.currentBet = raiseAmount;
                // レイズがあった場合、他のプレイヤーのアクション履歴をクリア
                this.playerActions.clear();
                this.playerActions.set(username, action);
                break;
        }
        
        this.nextPlayer();
        
        if (this.isRoundComplete()) {
            this.nextPhase();
        }
        
        return true;
    }
    
    nextPlayer() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (this.foldedPlayers.has(this.players[this.currentPlayerIndex].username));
    }
    
    isRoundComplete() {
        const activePlayers = this.players.filter(p => !this.foldedPlayers.has(p.username));
        if (activePlayers.length === 1) return true;
        
        // 全てのアクティブプレイヤーがアクションを取っているかチェック
        for (const player of activePlayers) {
            if (!this.playerActions.has(player.username)) {
                return false;
            }
        }
        
        // 全てのアクティブプレイヤーのベット額が揃っているかチェック
        for (const player of activePlayers) {
            const playerBet = this.playerBets.get(player.username) || 0;
            if (playerBet < this.currentBet && player.chips > 0) {
                return false;
            }
        }
        
        return true;
    }
    
    nextPhase() {
        // ベット情報とアクション履歴をクリア
        this.playerBets.clear();
        this.playerActions.clear();
        this.currentBet = 0;
        this.currentPlayerIndex = this.dealerIndex;
        this.nextPlayer();
        
        switch (this.phase) {
            case 'preflop':
                this.phase = 'flop';
                this.communityCards.push(this.deck.draw(), this.deck.draw(), this.deck.draw());
                break;
                
            case 'flop':
                this.phase = 'turn';
                this.communityCards.push(this.deck.draw());
                break;
                
            case 'turn':
                this.phase = 'river';
                this.communityCards.push(this.deck.draw());
                break;
                
            case 'river':
                this.phase = 'showdown';
                this.determineWinner();
                return; // ショーダウンの場合は早期終了
        }
        
        const activePlayers = this.players.filter(p => !this.foldedPlayers.has(p.username));
        if (activePlayers.length === 1) {
            this.phase = 'showdown';
            this.determineWinner();
        }
    }
    
    determineWinner() {
        const activePlayers = this.players.filter(p => !this.foldedPlayers.has(p.username));
        
        if (activePlayers.length === 1) {
            activePlayers[0].chips += this.pot;
            this.endRound();
            return activePlayers[0];
        }
        
        let winner = activePlayers[0];
        let bestHandValue = this.evaluateHand(winner.username);
        
        for (let i = 1; i < activePlayers.length; i++) {
            const handValue = this.evaluateHand(activePlayers[i].username);
            if (handValue > bestHandValue) {
                winner = activePlayers[i];
                bestHandValue = handValue;
            }
        }
        
        winner.chips += this.pot;
        this.endRound();
        return winner;
    }
    
    evaluateHand(username) {
        const hand = this.playerHands.get(username);
        const allCards = [...hand, ...this.communityCards];
        
        return Math.random() * 1000000;
    }
    
    endRound() {
        console.log(`Ending round ${this.currentRound} of ${this.maxRounds}`);
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
        
        if (this.currentRound >= this.maxRounds) {
            console.log('Game finished - max rounds reached');
            this.phase = 'finished';
        } else {
            this.currentRound++;
            console.log(`Starting next round: ${this.currentRound}`);
            // 次のラウンドの準備として場をリセット
            this.resetGame();
        }
    }
    
    resetGame() {
        // 次のラウンドに向けて場をリセット
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.playerHands.clear();
        this.playerBets.clear();
        this.playerActions.clear();
        this.foldedPlayers.clear();
        this.phase = 'waiting';
        this.currentPlayerIndex = 0;
    }
    
    getGameState(username) {
        const player = this.players.find(p => p.username === username);
        const isCurrentPlayer = this.players[this.currentPlayerIndex]?.username === username;
        
        console.log(`Getting game state for ${username}. Is current player: ${isCurrentPlayer}, Phase: ${this.phase}`);
        
        return {
            currentRound: this.currentRound,
            totalRounds: this.maxRounds,
            pot: this.pot,
            currentBet: this.currentBet,
            communityCards: this.communityCards,
            players: this.players.map((p, index) => ({
                username: p.username,
                chips: p.chips,
                currentBet: this.playerBets.get(p.username) || 0,
                isButton: index === this.dealerIndex,
                isCurrent: index === this.currentPlayerIndex,
                hasFolded: this.foldedPlayers.has(p.username)
            })),
            playerHand: this.playerHands.get(username),
            currentPlayer: this.players[this.currentPlayerIndex]?.username || null,
            possibleActions: isCurrentPlayer ? this.getPossibleActions(username) : [],
            phase: this.phase
        };
    }
    
    getPossibleActions(username) {
        const player = this.players.find(p => p.username === username);
        const playerBet = this.playerBets.get(username) || 0;
        const actions = [];
        
        if (this.foldedPlayers.has(username)) return [];
        
        actions.push('fold');
        
        // チェックかコール
        if (playerBet >= this.currentBet) {
            actions.push('check');
        } else if (this.currentBet > playerBet && player.chips > 0) {
            actions.push('call');
        }
        
        // ベットまたはレイズ
        if (player.chips > 0) {
            if (this.currentBet === 0) {
                // 誰もベットしていない場合はベット
                actions.push('bet');
            } else if (player.chips + playerBet > this.currentBet) {
                // 誰かがベットしている場合でもプレイヤーがレイズできる場合はレイズ
                actions.push('raise');
            }
        }
        
        return actions;
    }
}

module.exports = PokerGame;