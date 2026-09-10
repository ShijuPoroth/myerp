async function handleLogin(e) {
    e.preventDefault();
    const loginId = document.getElementById('login-id').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login_id: loginId, password })
        });
        if (response.ok) {
            const manager = await response.json();
            localStorage.setItem('mwh_current_module_manager', JSON.stringify(manager));
            window.location.href = '/app';
        } else {
            const data = await response.json();
            errorEl.textContent = data.error || 'Invalid credentials.';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
});
