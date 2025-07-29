const API_URL = '/api';
let isAdmin = false;

function adminLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.textContent = '';
    
    fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            isAdmin = true;
            localStorage.setItem('adminToken', data.token);
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            loadInitialData();
        } else {
            errorDiv.textContent = data.error || 'ログインに失敗しました';
        }
    })
    .catch(() => {
        errorDiv.textContent = '通信エラーが発生しました';
    });
}

function adminLogout() {
    localStorage.removeItem('adminToken');
    window.location.reload();
}

function getAdminHeader() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
    };
}

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'users') loadUsers();
    if (tabName === 'settings') loadSettings();
    if (tabName === 'messages') loadMessages();
}

async function loadInitialData() {
    await loadUsers();
    await loadSettings();
}

async function loadUsers() {
    const response = await fetch(`${API_URL}/admin/users`, {
        headers: getAdminHeader()
    });
    
    if (!response.ok) return;
    
    const users = await response.json();
    const container = document.getElementById('users-list');
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>ユーザー名</th>
                    <th>保有コイン</th>
                    <th>最終ログイン</th>
                    <th>登録日</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>
                            <div class="edit-coins">
                                <span id="coins-${user.id}">${user.coins.toLocaleString()}</span>
                                <input type="number" id="coins-input-${user.id}" value="${user.coins}" style="display: none;">
                                <button class="btn-secondary" id="edit-btn-${user.id}" onclick="editCoins(${user.id})">編集</button>
                                <button class="btn-secondary" id="save-btn-${user.id}" style="display: none;" onclick="saveCoins(${user.id})">保存</button>
                            </div>
                        </td>
                        <td>${user.last_login || '-'}</td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-secondary" onclick="deleteUser(${user.id})">削除</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function searchUsers() {
    const query = document.getElementById('user-search').value;
    const response = await fetch(`${API_URL}/admin/users?search=${query}`, {
        headers: getAdminHeader()
    });
    
    if (response.ok) {
        const users = await response.json();
        loadUsers(users);
    }
}

function editCoins(userId) {
    document.getElementById(`coins-${userId}`).style.display = 'none';
    document.getElementById(`coins-input-${userId}`).style.display = 'block';
    document.getElementById(`edit-btn-${userId}`).style.display = 'none';
    document.getElementById(`save-btn-${userId}`).style.display = 'block';
}

async function saveCoins(userId) {
    const newCoins = document.getElementById(`coins-input-${userId}`).value;
    
    const response = await fetch(`${API_URL}/admin/users/${userId}/coins`, {
        method: 'PUT',
        headers: getAdminHeader(),
        body: JSON.stringify({ coins: parseInt(newCoins) })
    });
    
    if (response.ok) {
        loadUsers();
    }
}

async function loadSettings() {
    const response = await fetch(`${API_URL}/admin/settings`, {
        headers: getAdminHeader()
    });
    
    if (!response.ok) return;
    
    const settings = await response.json();
    settings.forEach(setting => {
        const input = document.getElementById(setting.key);
        if (input) {
            input.value = setting.value;
        }
    });
}

async function updateSetting(key) {
    const value = document.getElementById(key).value;
    
    const response = await fetch(`${API_URL}/admin/settings/${key}`, {
        method: 'PUT',
        headers: getAdminHeader(),
        body: JSON.stringify({ value })
    });
    
    if (response.ok) {
        alert('設定を更新しました');
    }
}

async function sendMessage() {
    const title = document.getElementById('message-title').value;
    const content = document.getElementById('message-content').value;
    const giftCoins = parseInt(document.getElementById('gift-coins').value) || 0;
    
    if (!title || !content) {
        alert('タイトルと内容を入力してください');
        return;
    }
    
    const response = await fetch(`${API_URL}/admin/messages`, {
        method: 'POST',
        headers: getAdminHeader(),
        body: JSON.stringify({ title, content, gift_coins: giftCoins })
    });
    
    if (response.ok) {
        alert('メッセージを送信しました');
        document.getElementById('message-title').value = '';
        document.getElementById('message-content').value = '';
        document.getElementById('gift-coins').value = '0';
        loadMessages();
    }
}

async function loadMessages() {
    const response = await fetch(`${API_URL}/admin/messages`, {
        headers: getAdminHeader()
    });
    
    if (!response.ok) return;
    
    const messages = await response.json();
    const container = document.getElementById('messages-list');
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>タイトル</th>
                    <th>内容</th>
                    <th>プレゼントコイン</th>
                    <th>送信日時</th>
                </tr>
            </thead>
            <tbody>
                ${messages.map(msg => `
                    <tr>
                        <td>${msg.id}</td>
                        <td>${msg.title}</td>
                        <td>${msg.content}</td>
                        <td>${msg.gift_coins}</td>
                        <td>${new Date(msg.created_at).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadTableData() {
    const table = document.getElementById('table-select').value;
    if (!table) return;
    
    const response = await fetch(`${API_URL}/admin/database/${table}`, {
        headers: getAdminHeader()
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    const container = document.getElementById('table-data');
    
    if (data.length === 0) {
        container.innerHTML = '<p>データがありません</p>';
        return;
    }
    
    const columns = Object.keys(data[0]);
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    ${columns.map(col => `<th>${col}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>
                        ${columns.map(col => `<td>${row[col] || '-'}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

if (localStorage.getItem('adminToken')) {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadInitialData();
}