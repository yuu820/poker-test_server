const API_URL = '/api';

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    });
});

async function signup() {
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    const errorDiv = document.getElementById('signup-error');
    
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = 'ユーザーIDとパスワードを入力してください';
        return;
    }
    
    if (password !== passwordConfirm) {
        errorDiv.textContent = 'パスワードが一致しません';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorDiv.textContent = data.error || 'エラーが発生しました';
            return;
        }
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        window.location.href = '/html/home.html';
    } catch (error) {
        errorDiv.textContent = '通信エラーが発生しました';
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = 'ユーザーIDとパスワードを入力してください';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorDiv.textContent = data.error || 'エラーが発生しました';
            return;
        }
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        
        if (data.dailyBonus > 0) {
            alert(`ログインボーナス ${data.dailyBonus} コインを獲得しました！`);
        }
        
        window.location.href = '/html/home.html';
    } catch (error) {
        errorDiv.textContent = '通信エラーが発生しました';
    }
}