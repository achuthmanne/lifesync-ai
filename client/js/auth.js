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
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        if (password !== confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }

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

// Global Password Toggle
window.togglePasswordVisibility = (inputId, btn) => {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'far fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'far fa-eye';
    }
};

// REAL Google Auth Integration
// Note: Replace this placeholder with your actual Google Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = "203984163976-iql62mch75gllceojji3s1gbbvnpkt7v.apps.googleusercontent.com";

window.handleGoogleCredentialResponse = async (response) => {
    try {
        const btns = document.querySelectorAll('.btn-google');
        btns.forEach(btn => {
            btn.classList.add('loading');
            btn.querySelector('.google-text').textContent = 'Authenticating...';
            btn.disabled = true;
        });

        const data = await api.auth.googleLogin(response.credential);

        showNotification('Google login successful!', 'success');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
        const errors = document.querySelectorAll('.google-error');
        errors.forEach(err => {
            err.textContent = error.message;
            err.style.display = 'block';
        });
    } finally {
        const btns = document.querySelectorAll('.btn-google');
        btns.forEach(btn => {
            btn.classList.remove('loading');
            btn.querySelector('.google-text').textContent = 'Continue with Google';
            btn.disabled = false;
        });
    }
};

window.initiateGoogleAuth = () => {
    if (GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
        showNotification("Please set your real Google Client ID in js/auth.js", "info");
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        cancel_on_tap_outside: false,
        auto_select: false
    });

    // Using the popup picker flow for a better manual button experience
    google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If One Tap fails or is skipped, we can optionally trigger a fallback or ignore
            console.log('One Tap dismissed or skipped');
        }
    });
};
