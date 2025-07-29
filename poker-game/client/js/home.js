if (!checkAuth()) {
    window.location.href = '/';
}

document.getElementById('username-display').textContent = localStorage.getItem('username');

async function loadUserData() {
    const response = await fetchWithAuth(`${API_URL}/game/user-info`);
    if (!response) return;
    
    const data = await response.json();
    document.getElementById('coin-count').textContent = data.coins.toLocaleString();
}

async function loadMessages() {
    const response = await fetchWithAuth(`${API_URL}/game/messages`);
    if (!response) return;
    
    const messages = await response.json();
    const container = document.getElementById('messages-container');
    
    if (messages.length === 0) {
        container.innerHTML = '<p class="no-messages">新しいメッセージはありません</p>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="message-item">
            <div class="message-title">${msg.title}</div>
            <div class="message-content">${msg.content}</div>
            ${msg.gift_coins > 0 ? `
                <div class="gift-coins" onclick="claimGift(${msg.id}, ${msg.gift_coins})">
                    プレゼント: ${msg.gift_coins} コイン受け取る
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function claimGift(messageId, coins) {
    const response = await fetchWithAuth(`${API_URL}/game/claim-gift`, {
        method: 'POST',
        body: JSON.stringify({ messageId })
    });
    
    if (!response) return;
    
    if (response.ok) {
        alert(`${coins} コインを受け取りました！`);
        loadUserData();
        loadMessages();
    }
}

function showCreateMatch() {
    showModal('create-match-modal');
}

function showJoinMatch() {
    showModal('join-match-modal');
}

async function createMatch() {
    const data = {
        maxCoins: parseInt(document.getElementById('max-coins').value),
        smallBlind: parseInt(document.getElementById('small-blind').value),
        maxRounds: parseInt(document.getElementById('max-rounds').value),
        maxPlayers: parseInt(document.getElementById('max-players').value)
    };
    
    const response = await fetchWithAuth(`${API_URL}/game/create-match`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (!response) return;
    
    const result = await response.json();
    if (response.ok) {
        window.location.href = `/html/match.html?code=${result.code}`;
    } else {
        alert(result.error || 'エラーが発生しました');
    }
}

async function joinMatch() {
    const code = document.getElementById('join-code').value;
    
    if (code.length !== 5) {
        alert('5桁のコードを入力してください');
        return;
    }
    
    const response = await fetchWithAuth(`${API_URL}/game/join-match`, {
        method: 'POST',
        body: JSON.stringify({ code })
    });
    
    if (!response) return;
    
    const result = await response.json();
    if (response.ok) {
        window.location.href = `/html/match.html?code=${code}`;
    } else {
        alert(result.error || 'エラーが発生しました');
    }
}

loadUserData();
loadMessages();