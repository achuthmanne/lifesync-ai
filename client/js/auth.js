document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');

    // Toggle between login and register
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.style.display = 'none';
        registerCard.style.display = 'block';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerCard.style.display = 'none';
        loginCard.style.display = 'block';
    });

    // Login logic
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
            submitBtn.classList.add('btn-loading');
            const data = await api.auth.login({ email, password });
            
            showNotification('Login successful! Redirecting...', 'success');
            
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            submitBtn.classList.remove('btn-loading');
        }
    });

    // Register logic
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        try {
            submitBtn.classList.add('btn-loading');
            const data = await api.auth.register({ name, email, password });
            
            showNotification('Account created successfully!', 'success');
            
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            submitBtn.classList.remove('btn-loading');
        }
    });

});
