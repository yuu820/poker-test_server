if (!checkAuth()) {
    window.location.href = '/';
}

const urlParams = new URLSearchParams(window.location.search);
const matchCode = urlParams.get('code');
const socket = io();

let currentUser = localStorage.getItem('username');
let matchData = null;
let isCreator = false;

socket.emit('join-match', {
    code: matchCode,
    token: localStorage.getItem('token')
});

socket.on('match-update', (data) => {
    matchData = data;
    updateWaitingRoom(data);
});

socket.on('match-started', () => {
    document.getElementById('waiting-room').style.display = 'none';
    document.getElementById('game-room').style.display = 'block';
});

socket.on('game-update', (data) => {
    console.log('Game update received:', data);
    updateGameState(data);
});

socket.on('match-finished', (data) => {
    showResultScreen(data);
});

socket.on('error', (error) => {
    alert(error.message);
    if (error.redirect) {
        window.location.href = '/html/home.html';
    }
});

function updateWaitingRoom(data) {
    document.getElementById('match-code').textContent = matchCode;
    document.getElementById('current-players').textContent = data.players.length;
    document.getElementById('max-players').textContent = data.maxPlayers;
    
    document.getElementById('info-max-coins').textContent = data.maxCoins.toLocaleString();
    document.getElementById('info-blinds').textContent = `${data.smallBlind}/${data.bigBlind}`;
    document.getElementById('info-rounds').textContent = data.maxRounds;
    
    const playersContainer = document.getElementById('players-container');
    playersContainer.innerHTML = data.players.map(player => `
        <div class="player-item ${player.isCreator ? 'creator' : ''}">
            <span class="player-name">${player.username}</span>
            ${player.isCreator ? '<span class="player-badge">作成者</span>' : ''}
        </div>
    `).join('');
    
    isCreator = data.players.find(p => p.username === currentUser)?.isCreator || false;
    const startBtn = document.getElementById('start-match-btn');
    if (isCreator && data.players.length >= 2) {
        startBtn.style.display = 'block';
    } else {
        startBtn.style.display = 'none';
    }
}

function startMatch() {
    if (!isCreator) return;
    socket.emit('start-match', { code: matchCode });
}

function leaveMatch() {
    if (confirm('マッチから退出しますか？')) {
        socket.emit('leave-match', { code: matchCode });
        window.location.href = '/html/home.html';
    }
}

function updateGameState(gameData) {
    console.log('=== updateGameState Debug ===');
    console.log('Phase:', gameData.phase);
    console.log('Current Player:', gameData.currentPlayer);
    console.log('Possible Actions:', gameData.possibleActions);
    console.log('Players:', gameData.players);
    console.log('Current User:', currentUser);
    
    // 自分が現在のプレイヤーかどうかを判定
    const isMyTurn = gameData.currentPlayer === currentUser;
    console.log('Is my turn?', isMyTurn, 'currentPlayer:', gameData.currentPlayer, 'currentUser:', currentUser);
    
    document.getElementById('current-round').textContent = gameData.currentRound;
    document.getElementById('total-rounds').textContent = gameData.totalRounds;
    document.getElementById('pot-size').textContent = gameData.pot.toLocaleString();
    
    // 現在のベット額を表示（ゲーム情報に追加）
    const gameInfoElement = document.querySelector('.game-info');
    if (gameData.currentBet > 0) {
        const currentBetSpan = document.getElementById('current-bet-display') || createCurrentBetDisplay();
        currentBetSpan.textContent = gameData.currentBet.toLocaleString();
    }
    
    updateCommunityCards(gameData.communityCards);
    updatePlayerPositions(gameData.players);
    updatePlayerHand(gameData.playerHand);
    updateActionControls(isMyTurn, gameData.possibleActions, gameData);
    
    const player = gameData.players.find(p => p.username === currentUser);
    if (player) {
        document.getElementById('player-chips').textContent = player.chips.toLocaleString();
        // 自分の現在のベット額も表示
        const playerInfoElement = document.querySelector('.player-info');
        updatePlayerBetInfo(playerInfoElement, player.currentBet);
    }
}

function createCurrentBetDisplay() {
    const gameInfo = document.querySelector('.game-info');
    const span = document.createElement('span');
    span.innerHTML = '現在のベット: <span id="current-bet-display">0</span>';
    gameInfo.appendChild(span);
    return document.getElementById('current-bet-display');
}

function updatePlayerBetInfo(container, currentBet) {
    let betSpan = container.querySelector('.player-current-bet');
    if (!betSpan && currentBet > 0) {
        betSpan = document.createElement('span');
        betSpan.className = 'player-current-bet';
        container.appendChild(betSpan);
    }
    
    if (betSpan) {
        if (currentBet > 0) {
            betSpan.textContent = `現在のベット: ${currentBet.toLocaleString()}`;
        } else {
            betSpan.remove();
        }
    }
}

function updateCommunityCards(cards) {
    const container = document.getElementById('community-cards');
    container.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        if (cards && cards[i]) {
            container.appendChild(createCardElement(cards[i]));
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            container.appendChild(placeholder);
        }
    }
}

function updatePlayerHand(hand) {
    const container = document.getElementById('player-hand');
    container.innerHTML = '';
    
    if (hand && hand.length === 2) {
        hand.forEach(card => {
            container.appendChild(createCardElement(card));
        });
    } else {
        for (let i = 0; i < 2; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            container.appendChild(placeholder);
        }
    }
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.className = `playing-card ${card.suit}`;
    div.innerHTML = `
        <span>${card.rank}</span>
        <span>${getSuitSymbol(card.suit)}</span>
    `;
    return div;
}

function getSuitSymbol(suit) {
    const symbols = {
        'hearts': '♥',
        'diamonds': '♦',
        'clubs': '♣',
        'spades': '♠'
    };
    return symbols[suit] || '';
}

function updatePlayerPositions(players) {
    const container = document.getElementById('players-area');
    container.innerHTML = '';
    
    const positions = calculatePlayerPositions(players.length);
    
    players.forEach((player, index) => {
        const seat = document.createElement('div');
        seat.className = 'player-seat';
        if (player.hasFolded) {
            seat.className += ' folded';
        }
        seat.style.left = positions[index].x + '%';
        seat.style.top = positions[index].y + '%';
        
        seat.innerHTML = `
            <div class="player-name">${player.username}</div>
            <div class="player-chips">残: ${player.chips.toLocaleString()}</div>
            ${player.currentBet > 0 ? `<div class="player-bet">ベット: ${player.currentBet.toLocaleString()}</div>` : ''}
            ${player.isButton ? '<div class="dealer-button">D</div>' : ''}
            ${player.isCurrent ? '<div class="current-player">▶</div>' : ''}
            ${player.hasFolded ? '<div class="folded-text">フォールド</div>' : ''}
        `;
        
        container.appendChild(seat);
    });
}

function calculatePlayerPositions(count) {
    const positions = [];
    const centerX = 50;
    const centerY = 50;
    const radius = 40;
    
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        positions.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        });
    }
    
    return positions;
}

function updateActionControls(isCurrentPlayer, possibleActions, gameData) {
    console.log('updateActionControls called:', { isCurrentPlayer, possibleActions, gameData });
    
    const controls = document.getElementById('action-controls');
    const buttonsContainer = controls ? controls.querySelector('.action-buttons') : null;
    
    console.log('DOM elements found:', { 
        controls: controls, 
        buttonsContainer: buttonsContainer,
        controlsDisplay: controls ? controls.style.display : 'null',
        buttonsContainerHTML: buttonsContainer ? buttonsContainer.innerHTML : 'null'
    });
    
    if (!controls || !buttonsContainer) {
        console.error('Action controls or buttons container not found');
        return;
    }
    
    if (!isCurrentPlayer || !possibleActions || possibleActions.length === 0) {
        console.log('Hiding controls:', { 
            isCurrentPlayer, 
            possibleActions, 
            possibleActionsLength: possibleActions ? possibleActions.length : 'null',
            possibleActionsType: typeof possibleActions
        });
        controls.style.display = 'none';
        return;
    }
    
    controls.style.display = 'flex';
    buttonsContainer.innerHTML = '';
    
    // 各アクションボタンを生成
    console.log('Creating buttons for actions:', possibleActions);
    possibleActions.forEach(action => {
        console.log('Creating button for action:', action);
        const button = document.createElement('button');
        button.className = 'btn-action';
        button.onclick = () => {
            if (action === 'bet' || action === 'raise') {
                const betInput = document.getElementById('bet-amount');
                const amount = betInput ? betInput.value : '';
                if (!amount || amount <= 0) {
                    alert('ベット額を入力してください');
                    return;
                }
            }
            playerAction(action);
        };
        
        // アクション名を日本語に変換
        const actionNames = {
            'fold': 'フォールド',
            'check': 'チェック',
            'call': 'コール',
            'bet': 'ベット',
            'raise': 'レイズ'
        };
        
        let buttonText = actionNames[action] || action;
        
        // コールの場合、必要な金額を表示
        if (action === 'call' && gameData) {
            const player = gameData.players.find(p => p.username === currentUser);
            if (player) {
                const callAmount = gameData.currentBet - player.currentBet;
                buttonText += ` (${callAmount.toLocaleString()})`;
            }
        }
        
        button.textContent = buttonText;
        buttonsContainer.appendChild(button);
        console.log('Button appended:', button.textContent, 'Container children:', buttonsContainer.children.length);
    });
    
    console.log('Final buttons container HTML:', buttonsContainer.innerHTML);
    console.log('Final buttons container children count:', buttonsContainer.children.length);
    
    // ベット/レイズの場合は金額入力欄を表示
    const betInputContainer = controls.querySelector('.bet-input');
    if (betInputContainer) {
        if (possibleActions.includes('bet') || possibleActions.includes('raise')) {
            betInputContainer.style.display = 'flex';
        } else {
            betInputContainer.style.display = 'none';
        }
    }
}

function playerAction(action) {
    let amount = null;
    if (action === 'raise' || action === 'bet') {
        const betInput = document.getElementById('bet-amount');
        amount = betInput ? betInput.value : null;
    }
    
    console.log('Player action:', action, 'amount:', amount);
    
    socket.emit('player-action', {
        code: matchCode,
        action: action,
        amount: amount
    });
}

function showResultScreen(data) {
    document.getElementById('waiting-room').style.display = 'none';
    document.getElementById('game-room').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';
    
    if (data && data.finalCoins !== undefined) {
        document.getElementById('final-coins').textContent = data.finalCoins.toLocaleString();
    }
    
    if (data && data.ranking) {
        updateRanking(data.ranking);
    } else {
        socket.emit('get-match-results', { code: matchCode });
    }
}

function updateRanking(ranking) {
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    ranking.forEach((player, index) => {
        const rankItem = document.createElement('div');
        rankItem.className = `ranking-item rank-${index + 1}`;
        
        rankItem.innerHTML = `
            <div class="rank-number">${index + 1}</div>
            <div class="player-name">${player.username}</div>
            <div class="player-coins">${player.coins.toLocaleString()}</div>
        `;
        
        rankingList.appendChild(rankItem);
    });
}

function goHome() {
    window.location.href = '/html/home.html';
}