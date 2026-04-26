const API_BASE_URL = 'http://localhost:5000/api';

// Create notification container
const notifContainer = document.createElement('div');
notifContainer.className = 'notification-container';
document.body.appendChild(notifContainer);

function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} glass`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    notifContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

const api = {
    async request(endpoint, method = 'GET', body = null, isAuth = true) {
        const headers = {};
        
        // If body is NOT FormData, set JSON content type
        if (!(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (isAuth) {
            const token = localStorage.getItem('token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const config = {
            method,
            headers
        };

        if (body) {
            config.body = (body instanceof FormData) ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    auth: {
        login: (credentials) => api.request('/auth/login', 'POST', credentials, false),
        register: (userData) => api.request('/auth/register', 'POST', userData, false),
        getMe: () => api.request('/auth/me'),
        googleLogin: (credential) => api.request('/auth/google', 'POST', { credential }, false),
        forgotPassword: (email) => api.request('/auth/forgotpassword', 'POST', { email }, false),
        resetPassword: (data) => api.request('/auth/resetpassword', 'POST', data, false)
    },

    products: {
        getAll: () => api.request('/products'),
        getOne: (id) => api.request(`/products/${id}`),
        create: (product) => api.request('/products', 'POST', product),
        update: (id, product) => api.request(`/products/${id}`, 'PUT', product),
        delete: (id) => api.request(`/products/${id}`, 'DELETE'),
        identify: (formData) => api.request('/products/identify', 'POST', formData)
    },

    ai: {
        chat: (message, productId = null, history = [], currentScreen = 'Dashboard') => api.request('/ai/chat', 'POST', { message, productId, history, currentScreen }),
        getSummary: () => api.request('/ai/summary')
    },

    notifications: {
        getAll: () => api.request('/notifications'),
        markAsRead: (id) => api.request(`/notifications/${id}`, 'PUT'),
        delete: (id) => api.request(`/notifications/${id}`, 'DELETE'),
        clearAll: () => api.request('/notifications', 'DELETE')
    },

    feedback: {
        submit: (data) => api.request('/feedback', 'POST', data)
    },

    admin: {
        simulateTime: (data) => api.request('/admin/simulate-time', 'POST', data)
    },

    warranties: {
        getAll: () => api.request('/warranties'),
        upload: (formData) => api.request('/warranties/upload', 'POST', formData),
        delete: (id) => api.request(`/warranties/${id}`, 'DELETE')
    }
};
