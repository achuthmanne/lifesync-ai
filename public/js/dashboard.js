document.addEventListener('DOMContentLoaded', async () => {
    let appTime = new Date();

    const syncAppTime = (time) => {
        if (!time) return;
        appTime = new Date(time);
        console.log('[TimeSync] Application time synced to:', appTime.toISOString());
    };
    // --- LOGO HELPERS ---
    window.getAILogo = (size = '') => {
        const id = 'ai-grad-' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="ls-ai-logo ${size}">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="var(--primary)" />
                            <stop offset="100%" stop-color="var(--accent)" />
                        </linearGradient>
                    </defs>
                    <!-- Maximum Spacing Ellipse -->
                    <path d="M3 9C3 6 7 4 12 4C17 4 21 6 21 9" stroke="url(#${id})" stroke-width="2.2" stroke-linecap="round"/>
                    <path d="M18 8L21 11L24 8Z" fill="url(#${id})" />
                    
                    <path d="M21 15C21 18 17 20 12 20C7 20 3 18 3 15" stroke="url(#${id})" stroke-width="2.2" stroke-linecap="round"/>
                    <path d="M6 16L3 13L0 16Z" fill="url(#${id})" />

                    <circle cx="12" cy="12" r="1.2" class="ai-core" fill="url(#${id})">
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="r" values="1;1.5;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                </svg>
            </div>
        `;
    };

    // AOS (Animate on Scroll) Implementation
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            }
        });
    }, observerOptions);

    document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));

    // Smooth scroll for landing links
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    window.openAuth = (type) => {
        const authModal = document.getElementById('auth-modal');
        const loginCard = document.getElementById('login-card');
        const registerCard = document.getElementById('register-card');
        
        if (authModal) {
            authModal.style.display = 'flex';
            if (type === 'login') {
                loginCard.style.display = 'block';
                registerCard.style.display = 'none';
            } else {
                loginCard.style.display = 'none';
                registerCard.style.display = 'block';
            }
        }
    };

    const closeAuthBtn = document.getElementById('close-auth-modal');
    if (closeAuthBtn) {
        closeAuthBtn.addEventListener('click', () => {
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.style.display = 'none';
                authModal.classList.remove('full-page-auth');
            }
        });
    }

    // Global Elements (Needed for both Landing and App)
    const chatForm = document.getElementById('chat-form');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-msg');
    const chatModal = document.getElementById('chat-modal');
    const closeChatBtn = document.getElementById('close-chat-modal');
    const voiceBtn = document.getElementById('voice-btn');

    let chatHistory = []; 
    let currentActiveView = 'Landing Page';

    // Shared Chat Handlers (Hoisted)
    function initChatHandlers() {
        if (!chatForm) return;
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            const msg = chatInput.value.trim();
            if (!msg) return;

            appendMessage('user', msg);
            chatInput.value = '';

            const typingId = 'typing-' + Date.now();
            const typingDiv = document.createElement('div');
            typingDiv.id = typingId;
            typingDiv.className = 'message msg-ai typing-msg';
            typingDiv.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const res = await api.ai.chat(msg, null, chatHistory, currentActiveView);
                const typingEl = document.getElementById(typingId);
                if (typingEl) typingEl.remove();
                
                let aiText = res.data.text;
                let provider = res.data.provider;
                let suggestions = [];

                if (res.data.limitReached) {
                    showLimitReached('aiRequests');
                }

                const suggestRegex = /\[?\s*SUGGESTIONS:\s*(.*?)\]?\s*$/i;
                const suggestMatch = aiText.match(suggestRegex);
                if (suggestMatch) {
                    const content = suggestMatch[1];
                    let rawSuggestions = content.includes('|') ? content.split('|') : (content.includes(',') ? content.split(',') : content.split(/(?<=\?)/));
                    suggestions = rawSuggestions.map(s => s.trim()).filter(s => s.length > 5).slice(0, 3);
                    aiText = aiText.replace(suggestMatch[0], '').trim();
                }

                typeMessage('ai', aiText, provider);

                if (suggestions.length > 0) {
                    renderDynamicSuggestions(suggestions);
                } else {
                    if (localStorage.getItem('token')) {
                        try {
                            const inventoryRes = await api.products.getAll();
                            refreshChatSuggestions(inventoryRes.data);
                        } catch (e) { refreshChatSuggestions([]); }
                    } else { refreshChatSuggestions([]); }
                }

                chatHistory.push({ role: 'user', content: msg });
                chatHistory.push({ role: 'assistant', content: aiText });
                if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
            } catch (error) {
                console.error('Chat Error:', error);
                const typingEl = document.getElementById(typingId);
                if (typingEl) typingEl.remove();
                appendMessage('ai', 'I apologize, but I encountered an error. Please try again.');
            }
        };
    }

    // Voice recognition logic
    if (voiceBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            voiceBtn.onclick = () => {
                if (voiceBtn.classList.contains('recording')) {
                    recognition.stop();
                } else {
                    recognition.start();
                    voiceBtn.classList.add('recording');
                    showNotification('Listening...', 'info');
                }
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                chatInput.value = transcript;
                voiceBtn.classList.remove('recording');
                if (transcript.length > 5) chatForm.dispatchEvent(new Event('submit'));
            };

            recognition.onerror = () => {
                voiceBtn.classList.remove('recording');
                showNotification('Voice recognition failed', 'error');
            };

            recognition.onend = () => voiceBtn.classList.remove('recording');
        } else {
            voiceBtn.style.display = 'none';
        }
    }

    // Close Button & Background Click
    if (closeChatBtn) closeChatBtn.onclick = closeChat;
    window.addEventListener('click', (event) => {
        if (event.target == chatModal) closeChat();
    });

    // Typewriter effect for Final CTA
    const typewriter = document.getElementById('typewriter-text');
    if (typewriter) {
        const words = ["smarter", "faster", "intelligently", "effortlessly"];
        let wordIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        
        typewriter.textContent = ''; // Start clean

        const type = () => {
            const currentWord = words[wordIndex];
            
            if (isDeleting) {
                typewriter.textContent = currentWord.substring(0, charIndex - 1);
                charIndex--;
            } else {
                typewriter.textContent = currentWord.substring(0, charIndex + 1);
                charIndex++;
            }

            let typeSpeed = isDeleting ? 60 : 120;

            if (!isDeleting && charIndex === currentWord.length) {
                isDeleting = true;
                typeSpeed = 2500; // Hold word
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                wordIndex = (wordIndex + 1) % words.length;
                typeSpeed = 500;
            }

            setTimeout(type, typeSpeed);
        };
        
        setTimeout(type, 1000);
    }

    // Auth Check
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    const authModal = document.getElementById('auth-modal');
    
    if (!token || !user) {
        if (appView) appView.style.display = 'none';
        if (landingView) landingView.style.display = 'block';
        if (authModal) authModal.classList.add('full-page-auth');
        initChatHandlers();
        return;
    }

    currentActiveView = 'Dashboard';

    window.showBilling = () => {
        switchView('billing');
    };

    window.closeLimitModal = () => {
        const modal = document.getElementById('limit-modal');
        if (modal) modal.style.display = 'none';
    };

    window.showLimitReached = (type) => {
        const modal = document.getElementById('limit-modal');
        const msg = document.getElementById('limit-modal-msg');
        if (type === 'products') {
            msg.innerText = "You've reached your free product limit. Upgrade to Pro for unlimited assets and deep AI insights.";
        } else if (type === 'aiRequests') {
            msg.innerText = "You've reached your monthly AI request limit. Upgrade to Pro to continue chatting and getting diagnostics.";
        }
        if (modal) modal.style.display = 'flex';
    };

    window.simulateUpgrade = async (plan) => {
        try {
            const res = await fetch('/api/auth/upgrade', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ plan })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.data));
                showNotification(`Successfully upgraded to ${plan.toUpperCase()}!`, 'success');
                if (typeof loadDashboard === 'function') loadDashboard();
                showBilling();
            }
        } catch (error) {
            showNotification('Upgrade failed. Please try again.', 'error');
        }
    };

    const updateBillingUsage = () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;

        const planName = document.getElementById('billing-plan-name');
        if (planName) planName.textContent = user.plan.charAt(0).toUpperCase() + user.plan.slice(1);
        
        const prodCount = document.getElementById('billing-prod-count');
        const prodBar = document.getElementById('billing-prod-bar');
        if (prodCount) prodCount.textContent = `${user.usage.products} / ${user.limits.products}`;
        if (prodBar) prodBar.style.width = `${Math.min(100, (user.usage.products / user.limits.products) * 100)}%`;
        
        const aiCount = document.getElementById('billing-ai-count');
        const aiBar = document.getElementById('billing-ai-bar');
        if (aiCount) aiCount.textContent = `${user.usage.aiRequests} / ${user.limits.aiRequests}`;
        if (aiBar) aiBar.style.width = `${Math.min(100, (user.usage.aiRequests / user.limits.aiRequests) * 100)}%`;
    };

    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (authModal) authModal.style.display = 'none';

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
    const welcomeText = document.getElementById('welcome-text');
    const userNameDisplay = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');
    const logoutBtn = document.getElementById('logout-btn');
    const productsList = document.getElementById('products-list');
    const productModal = document.getElementById('product-modal');
    const addProductBtn = document.getElementById('add-product-btn');
    const closeModal = document.getElementById('close-modal');
    const productForm = document.getElementById('product-form');
    const modalTitle = productModal.querySelector('h3');
    const submitBtn = productForm.querySelector('button[type="submit"]');
    const prodBrandInput = document.getElementById('prod-brand');
    const autofillBadge = document.getElementById('autofill-badge');
    const fetchingStatus = document.getElementById('fetching-status');
    const manualBarcodeInput = document.getElementById('manual-barcode');
    const manualBarcodeBtn = document.getElementById('manual-barcode-btn');


    let editingProductId = null;

    // App UI Elements
 
    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalytics = document.getElementById('nav-analytics');
    const navNotifications = document.getElementById('nav-notifications');
    const dashboardView = document.getElementById('dashboard-view');
    const analyticsView = document.getElementById('analytics-view');
    const notificationsView = document.getElementById('notifications-view');
    const notificationsList = document.getElementById('notifications-list');
    const notifBadge = document.getElementById('notif-count-badge');
    const navWarranty = document.getElementById('nav-warranty');
    const warrantyView = document.getElementById('warranty-view');

    let currentViewedProductId = null;
    let analyticsCharts = {};
    let allNotifications = [];
    let currentNotifFilter = 'all';

    // Init UI
    userNameDisplay.textContent = user.name;
    if (userAvatar) {
        userAvatar.textContent = (user && user.name) ? user.name.charAt(0).toUpperCase() : 'U';
    }
    welcomeText.textContent = `Hello, ${user.name.split(' ')[0]}!`;

    // Socket Initialization
    const socket = io();
    socket.on('connect', () => {
        socket.emit('authenticate', user.id);
    });

    socket.on('product_update', (updatedProduct) => {
        console.log('Product updated via socket:', updatedProduct);
        loadDashboard();
        
        // If the modal for this product is currently open, refresh it
        if (currentViewedProductId === updatedProduct._id) {
            renderDetails(updatedProduct);
        }
    });

    socket.on('notification', (notif) => {
        showNotification(notif.message, notif.type || 'info');
        loadNotifications(false); // Refresh list in background
    });

    socket.on('time_shift', (data) => {
        console.log('Time shifted:', data);
        showNotification(data.message, 'info');
        updateSimClock(new Date(data.currentTime));
        loadDashboard();
    });

    socket.on('ai_status', (data) => {
        console.log('AI Status:', data);
        
        // Update Identification Status if active
        const fetchingStatus = document.getElementById('fetching-status');
        if (fetchingStatus && fetchingStatus.style.display === 'flex') {
            const statusText = fetchingStatus.querySelector('span');
            if (statusText) {
                statusText.textContent = `AI is ${data.status === 'active' ? 'connecting to' : data.status === 'success' ? 'completing with' : 'switching from'} ${data.engine}...`;
            }
        }

        if (data.status === 'success' && data.productId) {
            // Update product card or dashboard
            loadDashboard();
        }

        updateEngineUI(data.engine, data.status, data.message);
        
        if (data.productId) {
            updateProductCardStatus(data.productId, data.engine, data.status, data.message);
        }
    });

    const updateProductCardStatus = (productId, engine, status, message) => {
        // Find the product card
        const cards = document.querySelectorAll('.product-card');
        let targetCard = null;
        
        // This is a bit tricky because cards don't have IDs in the DOM directly in a clean way except via the onclick buttons
        // I'll update the render logic to add a data-id to the card
        const card = document.querySelector(`.product-card[data-id="${productId}"]`);
        if (!card) return;

        const statusLabel = card.querySelector('.analyzing-status-label');
        if (statusLabel) {
            statusLabel.innerHTML = `<span>${message}</span>`;
        }
    };

    // Navigation Logic
    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');

    profileToggle.onclick = (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
    };

    document.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('active');
    });

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        };
    }

    profileDropdown.onclick = (e) => e.stopPropagation();

    // Profile Menu Functions
    window.showAbout = () => {
        showCustomAlert('About LifeSync AI', `
            <div style="text-align: left; line-height: 1.6;">
                <p>LifeSync AI is an enterprise-grade product lifecycle management platform powered by multiple AI engines (OpenAI, Gemini, Groq, Cohere).</p>
                <p style="margin-top: 15px;">Our mission is to extend the life of your valuable assets through predictive maintenance and proactive care.</p>
                <p style="margin-top: 15px; color: var(--text-muted); font-size: 0.8rem;">Version: 1.0.4 (Production Stable)</p>
            </div>
        `);
    };

    window.showHelp = () => {
        showCustomAlert('Help Center', `
            <div style="text-align: left; line-height: 1.6;">
                <p>Need assistance? Our support team is available 24/7.</p>
                <ul style="margin-top: 15px; padding-left: 20px;">
                    <li>Adding Products: Use the "Add Product" button in the sidebar.</li>
                    <li>AI Insights: AI diagnostics run automatically after adding an item.</li>
                    <li>Notifications: Check the bell icon for critical updates.</li>
                </ul>
                <p style="margin-top: 15px;">Email: support@lifesync-ai.com</p>
            </div>
        `);
    };

    window.showFeedback = () => {
        // Reset modal state for a fresh experience
        const fbCategoryInput = document.getElementById('fb-category');
        const fbSelected = document.querySelector('#fb-category-container .select-selected');
        const stars = document.querySelectorAll('#feedback-stars i');
        
        stars.forEach(s => s.classList.remove('active'));
        const ratingInput = document.getElementById('fb-rating');
        if (ratingInput) ratingInput.value = 0;
        
        if (fbCategoryInput) fbCategoryInput.value = '';
        if (fbSelected) {
            fbSelected.textContent = 'Select Category';
            fbSelected.classList.remove('select-arrow-active');
        }
        
        const items = document.querySelector('#fb-category-container .select-items');
        if (items) items.classList.add('select-hide');
        
        const msgInput = document.getElementById('fb-message');
        if (msgInput) msgInput.value = '';
        
        document.getElementById('feedback-modal').style.display = 'flex';
    };

    // Feedback Star Rating Logic
    const stars = document.querySelectorAll('#feedback-stars i');
    const ratingInput = document.getElementById('fb-rating');
    
    stars.forEach(star => {
        star.onclick = function() {
            const rating = this.getAttribute('data-rating');
            ratingInput.value = rating;
            
            // Update stars
            stars.forEach(s => {
                if (s.getAttribute('data-rating') <= rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        };
    });

    // Default to 0 stars
    stars.forEach(s => s.classList.remove('active'));

    // Universal Custom Select Logic
    const initCustomSelects = () => {
        const customSelects = document.querySelectorAll('.custom-select');
        
        customSelects.forEach(container => {
            if (container.dataset.initialized) return;
            container.dataset.initialized = 'true';

            const selected = container.querySelector('.select-selected');
            const items = container.querySelector('.select-items');
            const input = container.nextElementSibling;

            if (!selected || !items) return;

            // Use addEventListener for better reliability
            selected.addEventListener('click', function(e) {
                e.stopPropagation();
                
                const isHidden = items.classList.contains('select-hide');
                
                // Close all other dropdowns
                document.querySelectorAll('.select-items').forEach(el => el.classList.add('select-hide'));
                document.querySelectorAll('.select-selected').forEach(el => el.classList.remove('select-arrow-active'));

                if (isHidden) {
                    items.classList.remove('select-hide');
                    this.classList.add('select-arrow-active');
                }
            });

            // Selection logic
            items.querySelectorAll('div').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const val = this.getAttribute('data-value');
                    const txt = this.textContent;
                    
                    if (input && input.type === 'hidden') {
                        input.value = val;
                    }
                    
                    selected.innerHTML = this.innerHTML;
                    selected.classList.remove('select-arrow-active');
                    items.classList.add('select-hide');
                    
                    // Add active class for styling
                    items.querySelectorAll('div').forEach(d => d.classList.remove('same-as-selected'));
                    this.classList.add('same-as-selected');
                });
            });
        });
    };

    // Initialize all custom selects
    initCustomSelects();

    // Close all dropdowns on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.select-items').forEach(el => el.classList.add('select-hide'));
        document.querySelectorAll('.select-selected').forEach(el => el.classList.remove('select-arrow-active'));
    });

    // Feedback Form Submission (DB Connected)
    const feedbackForm = document.getElementById('feedback-form');
    feedbackForm.onsubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        const ratingInput = document.getElementById('fb-rating');
        const fbCategoryInput = document.getElementById('fb-category');
        
        const rating = ratingInput ? parseInt(ratingInput.value) : 0;
        const category = fbCategoryInput ? fbCategoryInput.value : '';
        const message = document.getElementById('fb-message').value.trim();
        
        if (rating === 0) {
            showNotification('Please select a star rating', 'warning');
            return;
        }
        
        if (!category) {
            showNotification('Please select a feedback category', 'warning');
            return;
        }

        const submitBtn = document.getElementById('submit-feedback');
        
        const data = {
            category,
            rating,
            message
        };
        
        try {
            submitBtn.classList.add('btn-loading');
            await api.feedback.submit(data);
            
            showNotification('Thank you! Your feedback has been recorded.', 'success');
            document.getElementById('feedback-modal').style.display = 'none';
            feedbackForm.reset();
            
            // Reset stars and category display
            document.querySelectorAll('#feedback-stars i').forEach(s => s.classList.remove('active'));
            if (ratingInput) ratingInput.value = 0;
            if (fbCategoryInput) fbCategoryInput.value = '';
            
            const fbSelected = document.querySelector('#fb-category-container .select-selected');
            if (fbSelected) fbSelected.textContent = 'Select Category';
        } catch (error) {
            showNotification('Failed to send feedback. Please try again.', 'error');
        } finally {
            submitBtn.classList.remove('btn-loading');
        }
    };

    // Time Simulation Logic
    const simPanel = document.getElementById('simulation-panel');
    const simClock = document.getElementById('sim-clock');
    const closeSimBtn = document.getElementById('close-sim-panel');
    
    const urlParams = new URLSearchParams(window.location.search);
    const isDebug = urlParams.get('debug') === 'true';

    const updateSimClock = (date) => {
        if (!simClock) return;
        const options = { 
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        };
        simClock.textContent = date.toLocaleDateString(undefined, options);
    };

    window.simulateTime = async (days, reset = false) => {
        console.log(`[Simulation] Shifting time by ${days} days (reset: ${reset})`);
        const btn = event.target;
        const originalText = btn.textContent;
        
        try {
            btn.textContent = 'Simulating...';
            btn.disabled = true;

            const body = reset ? { reset: true } : { days };
            const res = await api.admin.simulateTime(body);
            
            if (res.success) {
                console.log('[Simulation] Time shift success:', res.data);
                syncAppTime(res.data.currentTime);
                updateSimClock(appTime);
                showNotification(reset ? 'Simulation reset' : `Time shifted +${days} days`, 'success');
                await loadDashboard(); // Refresh UI
            }
        } catch (err) {
            console.error('[Simulation] Failed:', err);
            showNotification('Simulation failed: ' + err.message, 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    // Auto-refresh admin status if debug mode is requested
    if (isDebug && !user.isAdmin) {
        console.log('Debug mode requested, verifying admin status...');
        try {
            const me = await api.auth.getMe();
            if (me.success && me.data.isAdmin) {
                user.isAdmin = true;
                localStorage.setItem('user', JSON.stringify(me.data));
                console.log('Admin status verified. Enabling simulation...');
                window.location.reload(); // Reload to apply all admin features
            }
        } catch (e) {
            console.warn('Could not verify admin status:', e);
        }
    }

    if (user.isAdmin && isDebug) {
        simPanel.style.display = 'block';
        updateSimClock(appTime); // Initial
    }

    if (closeSimBtn) {
        closeSimBtn.onclick = () => simPanel.style.display = 'none';
    }

    const switchView = (viewName) => {
        dashboardView.style.display = 'none';
        analyticsView.style.display = 'none';
        notificationsView.style.display = 'none';
        if (warrantyView) warrantyView.style.display = 'none';
        const billingView = document.getElementById('billing-view');
        if (billingView) billingView.style.display = 'none';
        
        // Reset scroll position to top for a fresh view
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
        
        // Reset all nav items
        navDashboard.classList.remove('active');
        navAnalytics.classList.remove('active');
        navNotifications.classList.remove('active');
        if (navWarranty) navWarranty.classList.remove('active');
        const navBilling = document.getElementById('nav-billing');
        if (navBilling) navBilling.classList.remove('active');

        if (viewName === 'dashboard') {
            currentActiveView = 'Dashboard';
            dashboardView.style.display = 'block';
            navDashboard.classList.add('active');
            loadDashboard();
        } else if (viewName === 'analytics') {
            currentActiveView = 'Analytics';
            analyticsView.style.display = 'block';
            navAnalytics.classList.add('active');
            loadAnalytics();
        } else if (viewName === 'notifications') {
            currentActiveView = 'Notifications';
            notificationsView.style.display = 'block';
            navNotifications.classList.add('active');
            loadNotifications();
        } else if (viewName === 'warranty') {
            currentActiveView = 'Warranty Wallet';
            if (warrantyView) warrantyView.style.display = 'block';
            if (navWarranty) navWarranty.classList.add('active');
            loadWarrantyWallet();
        } else if (viewName === 'billing') {
            currentActiveView = 'Usage & Billing';
            if (billingView) billingView.style.display = 'block';
            if (navBilling) navBilling.classList.add('active');
            updateBillingUsage();
        }
    };

    navDashboard.onclick = () => switchView('dashboard');
    navAnalytics.onclick = () => switchView('analytics');
    navNotifications.onclick = () => switchView('notifications');
    if (navWarranty) navWarranty.onclick = () => switchView('warranty');
    const navBilling = document.getElementById('nav-billing');
    if (navBilling) navBilling.onclick = () => switchView('billing');

    const fullInventoryModal = document.getElementById('full-inventory-modal');
    const viewAllBtn = document.getElementById('view-all-products-btn');

    if (viewAllBtn) {
        viewAllBtn.onclick = () => {
            fullInventoryModal.style.display = 'flex';
            loadAllProducts();
        };
    }
    
    document.getElementById('refresh-analytics').onclick = async function() {
        const icon = this.querySelector('i');
        icon.classList.add('refresh-spinning');
        this.disabled = true;
        
        await loadAnalytics();
        
        setTimeout(() => {
            icon.classList.remove('refresh-spinning');
            this.disabled = false;
        }, 1000);
    };

    const updateEngineUI = (engineName, status, message) => {
        const id = `engine-${engineName.toLowerCase()}`;
        const row = document.getElementById(id);
        if (!row) return;

        const dot = row.querySelector('.status-dot');
        const text = row.querySelector('.engine-status-text');

        // Reset
        dot.className = 'status-dot';
        text.textContent = message;

        if (status === 'active') {
            dot.classList.add('active');
            row.classList.add('active-state');
        } else if (status === 'success') {
            dot.classList.add('active');
            row.classList.add('active-state');
            setTimeout(() => row.classList.remove('active-state'), 2000);
        } else if (status === 'failed') {
            dot.classList.add('inactive');
            row.classList.remove('active-state');
        }
    };

    // Chart Helpers
    let riskChartInstance = null;
    const renderRiskChart = (data) => {
        const ctx = document.getElementById('riskChart');
        if (!ctx) return;
        if (riskChartInstance) riskChartInstance.destroy();
        
        riskChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                datasets: [{
                    data: data,
                    backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                    }
                },
                cutout: '70%'
            }
        });
    };

    // Load Dashboard Data
    const loadDashboard = async () => {
        try {
            const response = await api.products.getAll();
            const products = response.data;
            syncAppTime(response.currentTime);
            updateSimClock(appTime);

            // Update Sidebar Usage
            try {
                const meRes = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const meData = await meRes.json();
                if (meData.success) {
                    const latestUser = meData.data;
                    localStorage.setItem('user', JSON.stringify(latestUser));
                    
                    const planName = document.getElementById('sidebar-plan-name');
                    const usageBar = document.getElementById('usage-bar-fill');
                    const usageText = document.getElementById('usage-text');
                    
                    if (planName) planName.textContent = latestUser.plan.charAt(0).toUpperCase() + latestUser.plan.slice(1) + ' Plan';
                    
                    const limit = latestUser.limits.products;
                    const used = latestUser.usage.products;
                    const percent = Math.min(100, (used / limit) * 100);
                    
                    if (usageBar) {
                        usageBar.style.width = `${percent}%`;
                        if (percent >= 90) usageBar.style.background = '#ef4444';
                        else if (percent >= 70) usageBar.style.background = '#f59e0b';
                        else usageBar.style.background = 'var(--primary)';
                    }
                    if (usageText) usageText.textContent = `${used} / ${limit} Products`;
                }
            } catch (e) { console.error('Usage sync failed:', e); }


            // Update Stats
            document.getElementById('total-count').textContent = products.length;
            
            const activeWarrantyCount = products.filter(p => {
                const purchaseDate = new Date(p.purchaseDate);
                const expiryDate = new Date(purchaseDate);
                expiryDate.setMonth(expiryDate.getMonth() + p.warrantyMonths);
                return expiryDate > appTime;
            }).length;
            document.getElementById('warranty-count').textContent = products.length > 0 ? activeWarrantyCount : '--';

            const riskCount = products.filter(p => p.aiInsights.riskLevel === 'High').length;
            document.getElementById('risk-count').textContent = products.length > 0 ? riskCount : '--';
            
            const avgHealth = products.length > 0 
                ? (products.reduce((acc, p) => acc + p.healthScore, 0) / products.length).toFixed(0) 
                : 0;
            
            document.getElementById('avg-health').textContent = products.length > 0 ? `${avgHealth}%` : '--';

            // Update Chart
            const distribution = [
                products.filter(p => p.aiInsights.riskLevel === 'Low').length,
                products.filter(p => p.aiInsights.riskLevel === 'Medium').length,
                riskCount
            ];
            renderRiskChart(distribution);

            // Visibility Toggles
            const viewAllBtn = document.getElementById('view-all-products-btn');
            const insightsSection = document.querySelector('.insights-section');
            
            if (viewAllBtn) viewAllBtn.style.display = products.length > 2 ? 'block' : 'none';
            if (insightsSection) insightsSection.style.display = products.length > 0 ? 'block' : 'none';

            // Refresh Analytics if visible
            if (analyticsView.style.display === 'block') {
                loadAnalytics();
            }

            // Refresh Chat Suggestions
            refreshChatSuggestions(products);

            // Render Products
            if (products.length === 0) {
                productsList.innerHTML = `
                    <div class="empty-state-view" style="grid-column: span 2; padding: 60px 20px;">
                        <div class="empty-state-icon">
                            <i class="fas fa-box-open"></i>
                        </div>
                        <h2>No Products Yet</h2>
                        <p>Add your first product to see AI-powered lifecycle predictions and health insights.</p>
                        <button class="btn btn-primary empty-state-btn" onclick="document.getElementById('add-product-btn').click()">
                            <i class="fas fa-plus"></i> Add Product Now
                        </button>
                    </div>
                `;
            } else {
                const mainProducts = products.slice(0, 2);
                productsList.innerHTML = mainProducts.map(p => renderProductCard(p)).join('');
            }

        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    };

    const loadAllProducts = async () => {
        try {
            const response = await api.products.getAll();
            const products = response.data;
            const fullList = document.getElementById('full-products-list');
            fullList.innerHTML = products.map(p => renderProductCard(p)).join('');
        } catch (error) {
            showNotification('Failed to load inventory', 'error');
        }
    };

    const renderProductCard = (p) => `
        <div class="product-card glass" data-id="${p._id}">
            <div class="card-header">
                <span class="badge badge-${p.lifecycleStage.toLowerCase().replace(' ', '-')}">${p.lifecycleStage}</span>
                <div class="health-indicator ${p.healthScore > 70 ? 'good' : p.healthScore > 40 ? 'medium' : 'poor'}">
                    <span class="health-dot"></span>
                    ${p.healthScore}% Health
                </div>
                <div class="risk-indicator ${p.failureProbability > 70 ? 'high' : p.failureProbability > 40 ? 'medium' : 'low'}">
                    <i class="fas fa-exclamation-circle"></i> ${p.failureProbability}% Risk
                </div>
            </div>
            
            <div class="card-body">
                <h3 class="product-name">${p.name}</h3>
                <p class="product-meta">
                    ${p.category} • ${new Date(p.purchaseDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </p>
                
                <div class="ai-insight-card">
                    <div class="ai-header">
                        ${getAILogo('small')}
                        <span>AI LIFECYCLE PREDICTION</span>
                    </div>
                    <div class="ai-prediction-text">
                        ${p.aiInsights.failurePrediction ? p.aiInsights.failurePrediction : `
                            <div class="analyzing-gap">
                                <div class="shimmer-line"></div>
                                <div class="shimmer-line short"></div>
                                <span class="analyzing-status-label">LifeSync AI is generating expert insights...</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <button class="action-btn details-btn" onclick="showDetails('${p._id}')">
                    <i class="fas fa-external-link-alt"></i> Details
                </button>
                <button class="action-btn delete-btn" onclick="deleteProduct('${p._id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;


    // Barcode Scanner Logic
    const manualTab = document.getElementById('manual-tab');
    const scanTab = document.getElementById('scan-tab');
    const scanSection = document.getElementById('scan-section');
    const startScanBtn = document.getElementById('start-scan-btn');
    const scannerView = document.getElementById('scanner-view');

    // Reset auto-fill states when manual tab clicked
    const resetAutofillEffects = () => {
        autofillBadge.style.display = 'none';
        document.querySelectorAll('.form-group input').forEach(input => {
            input.classList.remove('field-highlight');
        });
    };


    manualTab.onclick = () => {
        manualTab.classList.add('active');
        scanTab.classList.remove('active');
        scanSection.style.display = 'none';
        productForm.style.display = 'block';
    };

    scanTab.onclick = () => {
        scanTab.classList.add('active');
        manualTab.classList.remove('active');
        scanSection.style.display = 'block';
        productForm.style.display = 'none';
    };

    const barcodeUpload = document.getElementById('barcode-upload');
    let quaggaActive = false;

    const stopCamera = () => {
        if (quaggaActive) {
            Quagga.stop();
            quaggaActive = false;
        }
        scannerView.innerHTML = `
            <i class="fas fa-camera" style="font-size: 3rem; opacity: 0.2;"></i>
            <p style="margin-top: 15px; font-size: 0.9rem;">Initializing AI Vision...</p>
        `;
    };

    const startCamera = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Session expired. Please login again.', 'error');
            setTimeout(() => window.location.href = 'index.html', 1000);
            return;
        }

        try {

            stopCamera();
            scannerView.innerHTML = `<div id="quagga-scanner" style="width: 100%; height: 100%; overflow: hidden;"></div>`;
            
            // Short delay to ensure DOM element is rendered
            setTimeout(() => {
                Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: document.querySelector('#quagga-scanner'),
                        constraints: {
                            facingMode: "environment",
                            // Use ideal instead of min for better compatibility
                            width: { ideal: 640 },
                            height: { ideal: 480 }
                        },
                    },
                    decoder: {
                        readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"]
                    },
                    locate: true
                }, function(err) {
                    if (err) {
                        console.error('Quagga Init Error:', err);
                        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                            showNotification('Camera access denied. Please click the camera icon in your address bar to allow.', 'error');
                            scannerView.innerHTML = `
                                <div class="permission-hint">
                                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
                                    <h3>Camera Access Denied</h3>
                                    <p>Please enable camera permissions in your browser settings to use the real-time scanner.</p>
                                    <button class="btn btn-primary" style="margin-top: 15px;" onclick="location.reload()">I've enabled it, Reload</button>
                                </div>
                            `;
                        } else if (!window.isSecureContext) {
                            showNotification('Camera requires a secure connection (HTTPS or Localhost).', 'warning');
                        } else {
                            showNotification('Scanner hardware error. Please use Upload instead.', 'error');
                        }
                        return;
                    }
                    Quagga.start();
                    quaggaActive = true;
                    console.log("Quagga started successfully");
                });

                Quagga.onDetected(async (result) => {
                    if (!quaggaActive) return;
                    const code = result.codeResult.code;
                    if (!code) return;

                    console.log("Barcode detected:", code);
                    quaggaActive = false;
                    
                    try {
                        const overlay = document.createElement('div');
                        overlay.className = 'analyzing-overlay';
                        overlay.innerHTML = `
                            <i class="fas fa-barcode" style="font-size: 3rem; color: var(--primary);"></i>
                            <p>Barcode Detected: ${code}</p>
                            <p style="font-size: 0.8rem; margin-top: 10px;">AI fetching real-time details...</p>
                        `;
                        scannerView.appendChild(overlay);

                        // Capture current frame
                        let canvas = Quagga.canvas.dom.image;
                        if (!canvas) canvas = document.querySelector('#scanner-view canvas');
                        
                        if (canvas) {
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    processBarcodeAI('live', blob, code);
                                } else {
                                    console.warn("Blob creation failed, sending code only");
                                    processBarcodeAI('live', null, code);
                                }
                            }, 'image/jpeg', 0.7);
                        } else {
                            console.warn("No canvas found, sending code only");
                            processBarcodeAI('live', null, code);
                        }
                    } catch (err) {
                        console.error("onDetected Error:", err);
                        processBarcodeAI('live', null, code);
                    }
                });

            }, 100);

        } catch (err) {
            console.error('Camera Error:', err);
            showNotification('Could not access camera.', 'error');
        }
    };

    manualTab.onclick = () => {
        manualTab.classList.add('active');
        scanTab.classList.remove('active');
        scanSection.style.display = 'none';
        productForm.style.display = 'block';
        stopCamera();
    };

    scanTab.onclick = () => {
        scanTab.classList.add('active');
        manualTab.classList.remove('active');
        scanSection.style.display = 'block';
        productForm.style.display = 'none';
        resetAutofillEffects();
        startCamera();
    };

    const highlightAutofilledFields = () => {
        autofillBadge.style.display = 'inline-flex';
        const fields = ['prod-name', 'prod-brand', 'prod-warranty', 'prod-usage'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('field-highlight');
                // Remove highlight after animation
                setTimeout(() => el.classList.remove('field-highlight'), 3000);
            }
        });
    };

    const processBarcodeAI = async (source, file = null, barcode = null) => {
        const isUpload = source === 'upload' || source === 'manual';
        const originalBtnText = startScanBtn.innerHTML;
        
        // UI Feedback
        fetchingStatus.style.display = 'flex';
        
        if (source === 'upload') {
            startScanBtn.disabled = true;
            barcodeUpload.disabled = true;
            startScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Identifying...';
        } else if (source === 'manual') {
            manualBarcodeBtn.disabled = true;
            manualBarcodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            let formData = new FormData();
            if (file) {
                formData.append('barcode', file, 'scan.jpg');
            }
            if (barcode) {
                formData.append('barcodeNumber', barcode);
            }


            const response = await api.products.identify(formData);
            const data = response.data;

            // Auto-fill
            document.getElementById('prod-name').value = data.name;
            if (data.brand) document.getElementById('prod-brand').value = data.brand;
            document.getElementById('prod-warranty').value = data.warrantyMonths;
            document.getElementById('prod-usage').value = data.dailyUsageHours;
            
            const catContainer = document.getElementById('custom-category-container');
            if (catContainer) {
                const matchingItem = catContainer.querySelector(`.select-items div[data-value="${data.category}"]`);
                const selected = catContainer.querySelector('.select-selected');
                if (matchingItem && selected) {
                    selected.innerHTML = matchingItem.innerHTML;
                    const hiddenCat = document.getElementById('prod-category');
                    if (hiddenCat) hiddenCat.value = data.category;
                }
            }

            const condContainer = document.getElementById('custom-condition-container');
            if (condContainer && data.condition) {
                const val = data.condition.toLowerCase();
                const matchingItem = condContainer.querySelector(`.select-items div[data-value="${val}"]`);
                const selected = condContainer.querySelector('.select-selected');
                if (matchingItem && selected) {
                    selected.innerHTML = matchingItem.innerHTML;
                    const hiddenCond = document.getElementById('prod-condition');
                    if (hiddenCond) hiddenCond.value = val;
                }
            }


            showNotification(`Product Identified (${data.confidence}% confidence): ${data.name}`, 'success');
            
            // Cleanup and switch
            stopCamera();
            manualTab.click();
            highlightAutofilledFields();
        } catch (error) {
            console.error('Identification Error:', error);
            showNotification(error.message || 'Product not found. Please enter details manually.', 'error');
            
            if (source === 'live') {
                // Resume Quagga
                setTimeout(() => {
                    const overlay = scannerView.querySelector('.analyzing-overlay');
                    if (overlay) overlay.remove();
                    quaggaActive = true;
                }, 2000);
            }
        } finally {
            fetchingStatus.style.display = 'none';
            startScanBtn.disabled = false;
            barcodeUpload.disabled = false;
            manualBarcodeBtn.disabled = false;
            startScanBtn.innerHTML = originalBtnText;
            manualBarcodeBtn.innerHTML = 'Identify';
        }
    };

    manualBarcodeBtn.onclick = () => {
        const code = manualBarcodeInput.value.trim();
        if (!code) {
            showNotification('Please enter a barcode number', 'warning');
            return;
        }
        processBarcodeAI('manual', null, code);
    };

    startScanBtn.onclick = async () => {
        if (!quaggaActive) {
            showNotification('Camera not active. Please switch tabs or reload.', 'warning');
            return;
        }

        // Manual snapshot if detection is taking too long
        console.log("Manual snapshot triggered");
        try {
            let canvas = Quagga.canvas.dom.image;
            if (!canvas) canvas = document.querySelector('#scanner-view canvas');
            
            if (canvas) {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
                processBarcodeAI('live', blob, null); // No code, just visual identification
            } else {
                showNotification('Still initializing camera...', 'info');
            }
        } catch (err) {
            console.error('Manual snapshot error:', err);
        }
    };

    
    barcodeUpload.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                scannerView.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: contain; opacity: 0.7;">`;
                
                // Try to detect barcode locally first for higher accuracy
                Quagga.decodeSingle({
                    src: event.target.result,
                    numOfWorkers: 0, 
                    decoder: {
                        readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"]
                    },
                    locate: true
                }, function(result) {
                    if (result && result.codeResult) {
                        console.log("Barcode detected in upload:", result.codeResult.code);
                        processBarcodeAI('upload', file, result.codeResult.code);
                    } else {
                        console.log("No barcode detected in upload, falling back to pure AI Vision");
                        processBarcodeAI('upload', file);
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    };


    // Modal Controls
    addProductBtn.onclick = () => {
        editingProductId = null;
        modalTitle.textContent = 'Add New Product';
        submitBtn.textContent = 'Add Product';
        productForm.reset();
        if (manualBarcodeInput) manualBarcodeInput.value = '';
        if (autofillBadge) autofillBadge.style.display = 'none';
        
        // Reset custom selects to defaults

        document.querySelectorAll('.custom-select').forEach(selectContainer => {
            const firstItem = selectContainer.querySelector('.select-items div');
            const selected = selectContainer.querySelector('.select-selected');
            if (firstItem && selected) {
                selected.innerHTML = firstItem.innerHTML;
                const hiddenInput = selectContainer.nextElementSibling;
                if (hiddenInput) hiddenInput.value = firstItem.getAttribute('data-value');
            }
        });
        productModal.style.display = 'flex';
    };

    const closeProductModal = document.getElementById('close-product-modal');
    closeModal.onclick = () => {
        productModal.style.display = 'none';
        stopCamera();
    };
    closeProductModal.onclick = () => {
        productModal.style.display = 'none';
        stopCamera();
    };
    
    // Form Submission
    productForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const data = {
            name: document.getElementById('prod-name').value,
            brand: document.getElementById('prod-brand').value,
            category: document.getElementById('prod-category').value,
            purchaseDate: document.getElementById('prod-date').value,
            warrantyMonths: parseInt(document.getElementById('prod-warranty').value),
            dailyUsageHours: parseInt(document.getElementById('prod-usage').value),
            condition: document.getElementById('prod-condition').value
        };


        try {
            submitBtn.classList.add('btn-loading');
            
            if (editingProductId) {
                await api.products.update(editingProductId, data);
                showNotification('Product updated! Re-analyzing lifecycle...', 'info');
            } else {
                const res = await api.products.create(data);
                
                showNotification('Product added successfully!');
            }
            
            productModal.style.display = 'none';
            stopCamera();
            productForm.reset();
            loadDashboard();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            submitBtn.classList.remove('btn-loading');
        }
    };

    // Logout
    logoutBtn.onclick = () => {
        showConfirm('Logout Session', 'Are you sure you want to end your current session and logout?', 'danger').then(confirmed => {
            if (confirmed) {
                showNotification('Logging out...', 'info');
                localStorage.clear();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 800);
            }
        });
    };

    // Chat Logic handled by global listeners initialized above
    // Voice Recognition logic moved to top for shared access

    function initChatHandlers() {
        if (!chatForm) return;
        
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
        const msg = chatInput.value.trim();
        if (!msg) return;

        appendMessage('user', msg);
        chatInput.value = '';

        // Show Typing Indicator
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'message msg-ai typing-msg';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const res = await api.ai.chat(msg, null, chatHistory, currentActiveView);
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            
            let aiText = res.data.text;
            let provider = res.data.provider;
            let suggestions = [];

            // Robust Parsing for Suggestion Chips
            const suggestRegex = /\[?\s*SUGGESTIONS:\s*(.*?)\]?\s*$/i;
            const suggestMatch = aiText.match(suggestRegex);
            
            if (suggestMatch) {
                const content = suggestMatch[1];
                // Try splitting by pipe, then comma, then newline if needed
                let rawSuggestions = [];
                if (content.includes('|')) {
                    rawSuggestions = content.split('|');
                } else if (content.includes(',')) {
                    rawSuggestions = content.split(',');
                } else {
                    // Fallback to splitting by common question mark patterns
                    rawSuggestions = content.split(/(?<=\?)/);
                }
                
                suggestions = rawSuggestions.map(s => s.trim()).filter(s => s.length > 5).slice(0, 3);
                // Remove the suggestion block entirely from the visible text
                aiText = aiText.replace(suggestMatch[0], '').trim();
            }

            // Real-time Typewriter Effect
            typeMessage('ai', aiText, provider);

            // Render chips separately
            if (suggestions.length > 0) {
                renderDynamicSuggestions(suggestions);
            } else {
                // If AI fails to provide suggestions, generate some based on inventory
                if (localStorage.getItem('token')) {
                    try {
                        const inventoryRes = await api.products.getAll();
                        refreshChatSuggestions(inventoryRes.data);
                    } catch (e) {
                        refreshChatSuggestions([]);
                    }
                } else {
                    refreshChatSuggestions([]);
                }
            }


            // Update history
            chatHistory.push({ role: 'user', content: msg });
            chatHistory.push({ role: 'assistant', content: aiText });
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

        } catch (error) {
            console.error('Chat Error:', error);
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            appendMessage('ai', 'I apologize, but I encountered an error. Please try again.');
        }
    };
    }

    // Dynamic Suggestions Logic
    function refreshChatSuggestions(products) {
        const suggestBox = document.getElementById('chat-suggestions');
        if (!suggestBox) return;

        let suggestions = [];
        
        // Base suggestions
        if (products.length === 0) {
            suggestions = ["How does LifeSync work?", "What should I add first?"];
        } else {
            // Find high risk products
            const highRisk = products.find(p => p.aiInsights.riskLevel === 'High');
            if (highRisk) {
                suggestions.push(`How to fix my ${highRisk.name}?`);
                suggestions.push(`Maintenance for ${highRisk.name}`);
            }

            // Find categories
            const categories = [...new Set(products.map(p => p.category))];
            if (categories.length > 0) {
                suggestions.push(`Tips for ${categories[0]}?`);
            }

            // General status
            suggestions.push("Check all my products");
        }

        // Limit to 3 and render
        renderDynamicSuggestions(suggestions.slice(0, 3));
    }

    function renderDynamicSuggestions(questions) {
        const suggestBox = document.getElementById('chat-suggestions');
        if (!suggestBox || questions.length === 0) return;

        suggestBox.innerHTML = questions.map(s => `
            <button class="suggest-chip" data-query="${s}">${s}</button>
        `).join('');

        // Re-attach listeners
        suggestBox.querySelectorAll('.suggest-chip').forEach(chip => {
            chip.onclick = () => {
                const query = chip.getAttribute('data-query');
                chatInput.value = query;
                chatForm.dispatchEvent(new Event('submit'));
            };
        });
    }
    window.speakText = (text) => {
        if (!window.speechSynthesis) {
            showNotification('Speech synthesis not supported', 'warning');
            return;
        }
        
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        // Advanced Script Detection for Indian Languages
        let targetLang = 'en-US';
        if (/[\u0900-\u097F]/.test(text)) targetLang = 'hi-IN'; // Hindi/Marathi/Sanskrit
        else if (/[\u0B80-\u0BFF]/.test(text)) targetLang = 'ta-IN'; // Tamil
        else if (/[\u0C00-\u0C7F]/.test(text)) targetLang = 'te-IN'; // Telugu
        else if (/[\u0C80-\u0CFF]/.test(text)) targetLang = 'kn-IN'; // Kannada
        else if (/[\u0D00-\u0D7F]/.test(text)) targetLang = 'ml-IN'; // Malayalam
        else if (/[\u0980-\u09FF]/.test(text)) targetLang = 'bn-IN'; // Bengali
        else if (/[\u0A80-\u0AFF]/.test(text)) targetLang = 'gu-IN'; // Gujarati
        else if (/[\u0A00-\u0A7F]/.test(text)) targetLang = 'pa-IN'; // Punjabi

        // Selection priority: Natural/Premium > Online > Google > Microsoft > First match
        let selectedVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]) && (v.name.includes('Natural') || v.name.includes('Online')));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]) && v.name.includes('Google'));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]) && v.name.includes('Microsoft'));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        } else {
            utterance.lang = targetLang;
        }

        // Clarity optimization
        if (targetLang === 'en-US') {
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
        } else {
            // Slightly slower rate for regional languages makes the pronunciation much clearer
            utterance.rate = 0.88; 
            utterance.pitch = 1.05; // Slightly higher pitch often sounds more natural in regional TTS
        }
        
        window.speechSynthesis.speak(utterance);
    };

    function appendMessage(sender, text, provider = null) {
        const div = document.createElement('div');
        div.className = `message msg-${sender}`;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let header = '';
        if (sender === 'ai' && provider) {
            const iconHtml = getProviderIcon(provider);
            header = `<div class="msg-provider" style="display:flex; align-items:center; margin-bottom:10px;">${iconHtml}</div>`;
        }

        let speakerBtn = '';
        if (sender === 'ai') {
            speakerBtn = `
                <button class="msg-speaker-btn" title="Listen" data-text="${text.replace(/"/g, '&quot;')}">
                    <i class="fas fa-volume-up"></i>
                </button>
            `;
        }

        div.innerHTML = `
            ${header}
            <div class="msg-text">${text}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span class="msg-time">${timeStr}</span>
                ${speakerBtn}
            </div>
        `;

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    function typeMessage(sender, text, provider = null) {
        const messageDiv = appendMessage(sender, '', provider);
        const textContainer = messageDiv.querySelector('.msg-text');
        let i = 0;
        
        const typeChar = () => {
            if (i < text.length) {
                textContainer.innerHTML += text.charAt(i);
                i++;
                chatMessages.scrollTop = chatMessages.scrollHeight;
                setTimeout(typeChar, 15); // Adjust speed here
            } else {
                // Once done, update the speaker button text if it exists
                const speakerBtn = messageDiv.querySelector('.msg-speaker-btn');
                if (speakerBtn) speakerBtn.setAttribute('data-text', text);
            }
        };
        
        typeChar();
    }

    // Event Delegation for Speaker Buttons (more robust than onclick)
    chatMessages.addEventListener('click', (e) => {
        const btn = e.target.closest('.msg-speaker-btn');
        if (btn) {
            const text = btn.getAttribute('data-text');
            window.speakText(text);
        }
    });

    // Chat Modal Controls (with speech cancellation)
    
    function closeChat() {
        if (chatModal) chatModal.style.display = 'none';
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    window.openAIChat = (query = '') => {
        chatModal.style.display = 'flex';
        checkChatBadge();
        if (query) {
            chatInput.value = query;
            chatForm.dispatchEvent(new Event('submit'));
        }
    };

    window.scheduleCare = (name) => {
        showNotification(`Preparing care plan for ${name}...`, 'success');
        setTimeout(() => {
            window.openAIChat(`I want to schedule maintenance for my ${name}. Please provide a professional care checklist and recommended service intervals based on high-end SaaS standards.`);
        }, 800);
    };
    
    if (closeChatBtn) closeChatBtn.onclick = closeChat;

    // Close on background click
    window.onclick = (event) => {
        if (event.target == chatModal) closeChat();
    };

    // Initialize handlers at the end to ensure all functions are defined
    initChatHandlers();
    chatModal.onclick = (e) => {
        if (e.target === chatModal) closeChat();
    };

    // Reset notification badge if modal is open
    const checkChatBadge = () => {
        if (chatModal && chatModal.style.display === 'flex') {
            const badge = document.getElementById('chat-notif-badge');
            if (badge) badge.style.display = 'none';
        }
    };

    // Product Details Logic
    const detailsModal = document.getElementById('details-modal');
    window.showDetails = async (id) => {
        try {
            currentViewedProductId = id;
            const res = await api.products.getOne(id);
            renderDetails(res.data);
            detailsModal.style.display = 'flex';
        } catch (error) {
            showNotification('Failed to load details', 'error');
        }
    };

    const renderDetails = (product) => {
        document.getElementById('det-name').textContent = product.name;
        document.getElementById('det-category').textContent = (product.brand ? product.brand + ' • ' : '') + product.category;

        
        if (product.aiInsights.failurePrediction) {
            let lifespanHtml = '';
            if (product.lifespan) {
                lifespanHtml = `
                    <div class="lifespan-info-box" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; align-items: center; gap: 8px; color: var(--accent); font-weight: 600; font-size: 0.85rem; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                            <i class="fas fa-hourglass-half"></i> Lifespan Estimation
                        </div>
                        <div style="font-size: 1.1rem; font-weight: 500;">${product.lifespan.range}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">Approx. End-of-Life: <strong>${product.lifespan.endOfLifeYear}</strong></div>
                    </div>
                `;
            }

            document.getElementById('det-prediction').innerHTML = `
                <div class="prediction-text-large">${product.aiInsights.failurePrediction}</div>
                ${lifespanHtml}
            `;
            document.getElementById('det-tips').innerHTML = product.aiInsights.maintenanceTips.map(t => `
                <li class="tip-item">
                    <i class="fas fa-check-circle" style="color: var(--accent); margin-top: 4px;"></i>
                    <span>${t}</span>
                </li>
            `).join('');
            
            const providerBadge = document.getElementById('det-provider-badge');
            if (providerBadge) providerBadge.style.display = 'none';

        } else {
            document.getElementById('det-prediction').innerHTML = `<div class="analyzing-status">
                <span>LifeSync AI is performing deep diagnostics...</span>
            </div>`;
            document.getElementById('det-tips').innerHTML = '<li class="tip-item">Analyzing usage history...</li>';
            const providerBadge = document.getElementById('det-provider-badge');
            if (providerBadge) providerBadge.style.display = 'none';
        }

        const health = product.healthScore;
        const healthEl = document.getElementById('det-health');
        healthEl.textContent = `${health}%`;
        healthEl.style.color = health > 70 ? 'var(--success)' : health > 40 ? 'var(--warning)' : 'var(--danger)';
        
        document.getElementById('det-stage').textContent = product.lifecycleStage;
        document.getElementById('det-warranty').textContent = product.warrantyMonths > 0 ? 'Active' : 'Expired';
        
        const failureProb = product.failureProbability || 0;
        const failureEl = document.getElementById('det-failure');
        failureEl.textContent = `${failureProb}%`;
        failureEl.style.color = failureProb > 70 ? 'var(--danger)' : failureProb > 40 ? 'var(--warning)' : 'var(--success)';

        // Warranty Doc Section
        const warrantyDoc = allWarranties.find(w => w.productId === product._id);
        const warrantySection = document.getElementById('det-warranty-section');
        const viewDocBtn = document.getElementById('det-view-warranty-btn');

        if (warrantyDoc && warrantySection) {
            warrantySection.style.display = 'block';
            viewDocBtn.onclick = (e) => {
                e.stopPropagation();
                openPreview(warrantyDoc._id);
            };
        } else if (warrantySection) {
            warrantySection.style.display = 'none';
        }

        // Connect buttons
        document.getElementById('det-delete-btn').onclick = () => deleteProduct(product._id);
        document.getElementById('det-edit-btn').onclick = () => editProduct(product);
    };

    const editProduct = (product) => {
        editingProductId = product._id;
        modalTitle.textContent = 'Edit Product';
        submitBtn.textContent = 'Update Product';

        // Fill form
        document.getElementById('prod-name').value = product.name;
        document.getElementById('prod-brand').value = product.brand || '';
        document.getElementById('prod-category').value = product.category;
        document.getElementById('prod-date').value = product.purchaseDate.split('T')[0];
        document.getElementById('prod-warranty').value = product.warrantyMonths;
        document.getElementById('prod-usage').value = product.dailyUsageHours;
        document.getElementById('prod-condition').value = product.condition;


        // Update custom selects visuals
        const categorySelect = document.getElementById('custom-category-container');
        const conditionSelect = document.getElementById('custom-condition-container');

        const updateCustomSelect = (container, val) => {
            const selected = container.querySelector('.select-selected');
            const item = container.querySelector(`.select-items div[data-value="${val}"]`);
            if (item && selected) {
                selected.innerHTML = item.innerHTML;
                container.querySelectorAll('.select-items div').forEach(d => d.classList.remove('same-as-selected'));
                item.classList.add('same-as-selected');
            }
        };

        updateCustomSelect(categorySelect, product.category);
        updateCustomSelect(conditionSelect, product.condition);

        detailsModal.style.display = 'none';
        productModal.style.display = 'flex';
    };

    document.getElementById('close-details').onclick = () => {
        detailsModal.style.display = 'none';
        currentViewedProductId = null;
    };
    // Analytics Logic
    const loadAnalytics = async () => {
        try {
            const res = await api.products.getAll();
            const products = res.data;
            
            const analyticsContent = document.getElementById('analytics-content');
            const analyticsEmpty = document.getElementById('analytics-empty-state');

            if (products.length === 0) {
                analyticsContent.style.display = 'none';
                analyticsEmpty.style.display = 'block';
                
                // Clear summary boxes for empty state
                document.getElementById('top-category').textContent = '--';
                document.getElementById('overall-health-status').textContent = '--';
                document.getElementById('avg-age').textContent = '--';
                document.getElementById('attention-count').textContent = '--';

                analyticsEmpty.innerHTML = `
                    <div class="empty-state-view">
                        <div class="empty-state-icon">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                        <h2>Analytics Unavailable</h2>
                        <p>We need at least one product to generate diagnostic reports and lifecycle distributions. Add a product to unlock these insights.</p>
                        <button class="btn btn-primary empty-state-btn" onclick="document.getElementById('nav-dashboard').click()">
                            Return to Dashboard
                        </button>
                    </div>
                `;
                return;
            }

            analyticsContent.style.display = 'block';
            analyticsEmpty.style.display = 'none';

            // 1. Fetch AI Executive Summary
            const summaryText = document.getElementById('ai-exec-summary');
            api.ai.getSummary().then(res => {
                summaryText.textContent = res.data.text;
            }).catch(() => {
                summaryText.textContent = "AI summary service temporarily unavailable. Please refer to individual diagnostics.";
            });

            // 2. Fill Summary Cards (Plain English)
            const categories = products.map(p => p.category);
            const topCategory = categories.sort((a,b) =>
                categories.filter(v => v===a).length - categories.filter(v => v===b).length
            ).pop();
            document.getElementById('top-category').textContent = topCategory || 'None';

            const avgHealth = (products.reduce((acc, p) => acc + p.healthScore, 0) / products.length);
            const healthStatus = avgHealth > 80 ? 'Excellent' : avgHealth > 60 ? 'Good' : avgHealth > 40 ? 'Fair' : 'Poor';
            document.getElementById('overall-health-status').textContent = healthStatus;
            document.getElementById('overall-health-status').style.color = avgHealth > 60 ? '#4ade80' : '#f87171';

            // Calculate Avg Age (Supports simulation)
            // Use the current date from the server's time perspective if possible, 
            // but for now we'll just check if the simPanel is showing to guess if we should offset.
            // Better: just fetch it or use the value we have.
            // Since we don't have timeService on frontend, we use the clock text if available or just now.
            let now = new Date();
            const simClock = document.getElementById('sim-clock');
            if (simClock && simClock.textContent && simClock.textContent !== 'Initializing...') {
                try {
                    // Try to parse the sim clock text - this is a bit brittle but okay for demo
                    // A better way would be to have a global window.currentSimTime
                } catch(e) {}
            }

            const avgMonths = products.reduce((acc, p) => {
                const age = (now - new Date(p.purchaseDate)) / (1000 * 60 * 60 * 24 * 30.44);
                return acc + age;
            }, 0) / products.length;
            document.getElementById('avg-age').textContent = `${Math.max(0, avgMonths).toFixed(0)} Mo`;

            const attentionNeeded = products.filter(p => p.healthScore < 50).length;
            document.getElementById('attention-count').textContent = `${attentionNeeded} Items`;

            // 3. Fill Health Table
            const tableBody = document.getElementById('product-health-body');
            tableBody.innerHTML = products.map(p => `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td><span style="opacity: 0.7;">${p.category}</span></td>
                    <td>
                        <span class="risk-dot risk-${(p.aiInsights.riskLevel || 'Low').toLowerCase()}"></span>
                        ${p.aiInsights.riskLevel || 'Low'} Risk
                    </td>

                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="width: 40px;">${p.healthScore}%</span>
                            <div class="health-progress-bar">
                                <div class="health-progress-fill" style="width: ${p.healthScore}%; background: ${p.healthScore > 70 ? '#4ade80' : p.healthScore > 40 ? '#fbbf24' : '#f87171'}"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-${(p.lifecycleStage || 'active').toLowerCase().replace(' ', '-')}">${p.lifecycleStage || 'Active'}</span>
                    </td>

                </tr>
            `).join('');

            // 4. Distribution Chart
            const lifecycleData = {
                'New': 0, 'Active': 0, 'Maintenance': 0, 'Critical': 0, 'End-of-life': 0
            };
            products.forEach(p => lifecycleData[p.lifecycleStage]++);

            renderChart('lifecycleTrendChart', 'bar', {
                labels: Object.keys(lifecycleData),
                datasets: [{
                    label: 'Items',
                    data: Object.values(lifecycleData),
                    backgroundColor: ['#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#94a3b8'],
                    borderRadius: 4
                }]
            }, {
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            });

            // 5. Reliability Chart
            const uniqueCategories = [...new Set(categories)];
            const reliabilityCard = document.getElementById('categoryHealthChart').parentElement;
            
            if (uniqueCategories.length > 1) {
                const chartCanvas = document.getElementById('categoryHealthChart');
                if (chartCanvas) chartCanvas.style.display = 'block';
                const parent = chartCanvas.parentElement;
                const existingMsg = parent.querySelector('.insufficient-data-msg');
                if (existingMsg) existingMsg.remove();

                const catHealth = uniqueCategories.map(cat => {
                    const catProds = products.filter(p => p.category === cat);
                    return (catProds.reduce((acc, p) => acc + p.healthScore, 0) / catProds.length).toFixed(0);
                });

                renderChart('categoryHealthChart', 'doughnut', {
                    labels: uniqueCategories,
                    datasets: [{
                        data: catHealth,
                        backgroundColor: ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa'],
                        borderWidth: 0
                    }]
                }, {
                    cutout: '60%',
                    plugins: { legend: { position: 'bottom' } }
                });
            } else {
                // Not enough data for comparison
                const chartCanvas = document.getElementById('categoryHealthChart');
                if (chartCanvas) {
                    const ctx = chartCanvas.getContext('2d');
                    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
                    if (analyticsCharts['categoryHealthChart']) {
                        analyticsCharts['categoryHealthChart'].destroy();
                        delete analyticsCharts['categoryHealthChart'];
                    }
                    
                    const parent = chartCanvas.parentElement;
                    const existingMsg = parent.querySelector('.insufficient-data-msg');
                    if (!existingMsg) {
                        const msg = document.createElement('div');
                        msg.className = 'insufficient-data-msg';
                        msg.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px;">
                                <i class="fas fa-layer-group" style="font-size: 2.5rem; color: var(--text-muted); opacity: 0.3; margin-bottom: 15px; display: block;"></i>
                                <p style="color: var(--text-muted); font-size: 0.9rem;">Comparative reliability analysis requires products from <strong>multiple categories</strong>.</p>
                            </div>
                        `;
                        parent.appendChild(msg);
                        chartCanvas.style.display = 'none';
                    }
                }
            }

            // 6. Monthly Maintenance Outlook & Upgraded Roadmap
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const labels = [];
            const dataPoints = [0, 0, 0, 0, 0, 0];
            const roadmapData = [ [], [], [], [], [], [] ]; 
            
            const nowMonth = new Date().getMonth();
            for (let i = 0; i < 6; i++) {
                labels.push(monthNames[(nowMonth + i) % 12].substring(0, 3));
            }

            let aiInsightsText = "Based on your current fleet, we foresee a stable month ahead. Regular checks are advised for older appliances.";
            let highestRiskProduct = null;

            products.forEach(p => {
                const purchaseDate = new Date(p.purchaseDate);
                const expiryDate = new Date(purchaseDate);
                expiryDate.setMonth(expiryDate.getMonth() + p.warrantyMonths);
                
                const simNow = new Date(); // Support simulation if we had global time
                const diffTime = expiryDate - simNow;
                const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
                
                // 1. Warranty Events (Yellow - Maintenance)
                if (diffMonths >= 0 && diffMonths < 6) {
                    dataPoints[diffMonths]++;
                    roadmapData[diffMonths].push({
                        id: p._id,
                        name: p.name,
                        type: 'maintenance',
                        typeLabel: 'Maintenance',
                        reason: `Warranty expires this month. A full health check is recommended to identify pre-existing issues before coverage ends.`,
                        color: 'warning'
                    });
                }

                // 2. High Risk / Low Health Events (Red - Risk/Failure)
                // Decay simulation: predict when health drops below 40%
                const decayPerMonth = (p.dailyUsageHours * 1.5) + 2; // Rough estimation from monitoringService
                let projectedHealth = p.healthScore;
                
                for (let m = 0; m < 6; m++) {
                    projectedHealth -= decayPerMonth;
                    if (projectedHealth < 40 && !roadmapData[m].some(e => e.id === p._id && e.type === 'risk')) {
                        dataPoints[m]++;
                        roadmapData[m].push({
                            id: p._id,
                            name: p.name,
                            type: 'risk',
                            typeLabel: 'High Risk',
                            reason: `${p.name} health is projected to reach critical levels (${Math.round(projectedHealth)}%) due to high daily usage (${p.dailyUsageHours}h).`,
                            color: 'danger'
                        });
                        
                        if (!highestRiskProduct || projectedHealth < highestRiskProduct.health) {
                            highestRiskProduct = { name: p.name, health: projectedHealth, month: monthNames[(nowMonth + m) % 12] };
                        }
                        break; // Only one risk event per product in roadmap
                    }
                }
            });

            if (highestRiskProduct) {
                aiInsightsText = `The ${highestRiskProduct.name} is expected to require critical attention in ${highestRiskProduct.month} due to accelerated wear from heavy usage. We recommend scheduling a professional inspection before the health drops below 40%.`;
            } else if (products.length > 0) {
                const oldest = products.sort((a,b) => new Date(a.purchaseDate) - new Date(b.purchaseDate))[0];
                aiInsightsText = `Your inventory is currently in good standing. However, keep an eye on the ${oldest.name} as it approaches its maintenance window based on its age and usage patterns.`;
            }

            document.getElementById('ai-explanation-content').textContent = aiInsightsText;

            renderChart('projectionChart', 'line', {
                labels: labels,
                datasets: [{
                    label: 'Predicted Events',
                    data: dataPoints,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            }, {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const events = roadmapData[index];
                                if (events.length === 0) return 'No events predicted';
                                return events.map(e => `• ${e.name}: ${e.typeLabel}`).join('\n');
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { stepSize: 1, color: '#94a3b8' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            });

            // 7. Render Upgraded Roadmap List
            const roadmapContainer = document.getElementById('maintenance-roadmap');
            let roadmapHTML = '';
            
            let hasEvents = false;
            for (let i = 0; i < 6; i++) {
                if (roadmapData[i].length > 0) {
                    hasEvents = true;
                    const monthName = monthNames[(nowMonth + i) % 12];
                    roadmapHTML += `
                        <div class="roadmap-month">
                            <div class="roadmap-month-title">${monthName}</div>
                            ${roadmapData[i].map(event => `
                                <div class="roadmap-event">
                                    <div class="event-header">
                                        <span class="event-product">${event.name}</span>
                                        <span class="event-type-chip type-${event.type}">${event.typeLabel}</span>
                                    </div>
                                    <div class="event-reason">${event.reason}</div>
                                    <div class="event-actions">
                                        <button class="btn-mini btn-mini-primary" onclick="showDetails('${event.id}')">View Details</button>
                                        <button class="btn-mini" onclick="scheduleCare('${event.name}')">Schedule Care</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            }

            if (!hasEvents) {
                roadmapHTML = `
                    <div class="empty-roadmap">
                        <i class="fas fa-calendar-check"></i>
                        <p>No maintenance required in the next few months. Your products are in good condition.</p>
                    </div>
                `;
            }

            roadmapContainer.innerHTML = roadmapHTML;

        } catch (error) {
            console.error('Analytics Error:', error);
        }
    };

    const renderChart = (id, type, data, options = {}) => {
        const ctx = document.getElementById(id);
        if (!ctx) return;

        if (analyticsCharts[id]) {
            analyticsCharts[id].destroy();
        }

        analyticsCharts[id] = new Chart(ctx, {
            type,
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0', font: { family: 'Inter' } }
                    }
                },
                ...options
            }
        });
    };
    // Custom Confirm Logic
    const confirmModal = document.getElementById('confirm-modal');
    const showConfirm = (title, msg, type = 'info') => {
        return new Promise((resolve) => {
            const wrapper = document.getElementById('confirm-icon-wrapper');
            const icon = document.getElementById('confirm-icon');
            const okBtn = document.getElementById('confirm-ok');
            
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-msg').textContent = msg;
            
            // Theme mapping
            if (type === 'danger') {
                wrapper.style.background = 'rgba(239, 68, 68, 0.1)';
                wrapper.style.color = '#f87171';
                icon.className = 'fas fa-exclamation-circle';
                okBtn.className = 'btn btn-danger';
                okBtn.style.background = '#ef4444';
            } else {
                wrapper.style.background = 'rgba(59, 130, 246, 0.1)';
                wrapper.style.color = 'var(--primary)';
                icon.className = 'fas fa-info-circle';
                okBtn.className = 'btn btn-primary';
                okBtn.style.background = 'var(--primary)';
            }
            
            confirmModal.style.display = 'flex';

            document.getElementById('confirm-cancel').onclick = () => {
                confirmModal.style.display = 'none';
                resolve(false);
            };

            okBtn.onclick = () => {
                confirmModal.style.display = 'none';
                resolve(true);
            };
        });
    };

    window.showCustomAlert = (title, contentHTML, type = 'info') => {
        return new Promise((resolve) => {
            const wrapper = document.getElementById('confirm-icon-wrapper');
            const icon = document.getElementById('confirm-icon');
            const okBtn = document.getElementById('confirm-ok');

            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-msg').innerHTML = contentHTML;

            if (type === 'danger') {
                wrapper.style.background = 'rgba(239, 68, 68, 0.1)';
                wrapper.style.color = '#f87171';
                icon.className = 'fas fa-exclamation-circle';
                okBtn.style.background = '#ef4444';
            } else {
                wrapper.style.background = 'rgba(59, 130, 246, 0.1)';
                wrapper.style.color = 'var(--primary)';
                icon.className = 'fas fa-info-circle';
                okBtn.style.background = 'var(--primary)';
            }

            confirmModal.style.display = 'flex';
            
            const cancelBtn = document.getElementById('confirm-cancel');
            const originalDisplay = cancelBtn.style.display;
            cancelBtn.style.display = 'none';
            
            okBtn.onclick = () => {
                confirmModal.style.display = 'none';
                cancelBtn.style.display = originalDisplay;
                resolve(true);
            };
        });
    };

    function getProviderIcon(provider) {
        // Use our custom brand AI logo for all AI providers
        return getAILogo('small');
    }

    // Global helper for deletion
    window.deleteProduct = async (id) => {
        const confirmed = await showConfirm('Delete Product?', 'Are you sure you want to remove this product from your inventory? This action cannot be undone.', 'danger');
        if (confirmed) {
            try {
                await api.products.delete(id);
                showNotification('Product removed successfully', 'success');
                detailsModal.style.display = 'none';
                loadDashboard();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    };

    // Notifications Logic
    const loadNotifications = async (showLoading = true) => {
        if (showLoading) {
            notificationsList.innerHTML = `
                <div class="loading-state" style="text-align: center; padding: 50px; color: var(--text-muted);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 15px; display: block;"></i>
                    Syncing notifications...
                </div>
            `;
        }

        try {
            const res = await api.notifications.getAll();
            allNotifications = res.data;
            renderNotifications();
            updateNotifBadge();
        } catch (error) {
            notificationsList.innerHTML = `<div class="empty-state">Failed to load notifications.</div>`;
        }
    };

    const renderNotifications = () => {
        let filtered = allNotifications;
        
        if (currentNotifFilter === 'unread') {
            filtered = allNotifications.filter(n => !n.isRead);
        } else if (currentNotifFilter !== 'all') {
            filtered = allNotifications.filter(n => n.category === currentNotifFilter);
        }

        if (filtered.length === 0) {
            notificationsList.innerHTML = `
                <div class="empty-state-view" style="background: transparent; border: 1px dashed rgba(255,255,255,0.05);">
                    <div class="empty-state-icon" style="width: 80px; height: 80px; font-size: 2rem;">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <h3>Inbox is Clear</h3>
                    <p>You're all caught up! Critical updates about your products will appear here as they happen.</p>
                </div>
            `;
            return;
        }

        notificationsList.innerHTML = filtered.map(n => `
            <div class="notification-item glass ${n.isRead ? '' : 'unread'}" data-id="${n._id}">
                <div class="notif-icon-wrapper notif-icon-${n.type}">
                    <i class="fas ${getNotifIcon(n.category)}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-title">
                        ${n.title}
                        ${n.isRead ? '' : '<span class="unread-dot"></span>'}
                    </div>
                    <div class="notif-message">${n.message}</div>
                    <div class="notif-meta">
                        <span><i class="far fa-clock"></i> ${formatTime(n.createdAt)}</span>
                        <span><i class="fas fa-tag"></i> ${n.category ? n.category.charAt(0).toUpperCase() + n.category.slice(1) : 'General'}</span>

                    </div>
                </div>
                <div class="notif-actions">
                    ${n.isRead ? '' : `
                        <button class="notif-action-btn" title="Mark as read" onclick="markNotifRead('${n._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                    `}
                    <button class="notif-action-btn delete" title="Delete" onclick="deleteNotif('${n._id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    };

    const updateNotifBadge = () => {
        const unreadCount = allNotifications.filter(n => !n.isRead).length;
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notifBadge.style.display = 'flex';
        } else {
            notifBadge.style.display = 'none';
        }
    };

    function getNotifIcon(category) {
        switch(category) {
            case 'warranty': return 'fa-shield-alt';
            case 'health': return 'fa-heartbeat';
            case 'security': return 'fa-shield-virus';
            case 'maintenance': return 'fa-tools';
            default: return 'fa-info-circle';
        }
    }

    function formatTime(dateStr) {
        const date = new Date(dateStr);
        const now = appTime;
        const diff = (now - date) / 1000;

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentNotifFilter = this.getAttribute('data-filter');
            renderNotifications();
        };
    });

    window.markNotifRead = async (id) => {
        try {
            await api.notifications.markAsRead(id);
            allNotifications = allNotifications.map(n => n._id === id ? { ...n, isRead: true } : n);
            renderNotifications();
            updateNotifBadge();
        } catch (error) {
            showNotification('Failed to update notification', 'error');
        }
    };

    window.deleteNotif = async (id) => {
        try {
            await api.notifications.delete(id);
            allNotifications = allNotifications.filter(n => n._id !== id);
            renderNotifications();
            updateNotifBadge();
        } catch (error) {
            showNotification('Failed to delete notification', 'error');
        }
    };

    document.getElementById('mark-all-read').onclick = async () => {
        const unread = allNotifications.filter(n => !n.isRead);
        for (const n of unread) {
            await api.notifications.markAsRead(n._id);
        }
        allNotifications = allNotifications.map(n => ({ ...n, isRead: true }));
        renderNotifications();
        updateNotifBadge();
        showNotification('All marked as read');
    };

    document.getElementById('clear-all-notifs').onclick = async () => {
        const confirmed = await showConfirm('Clear All?', 'Are you sure you want to delete all notifications?', 'danger');
        if (confirmed) {
            try {
                await api.notifications.clearAll();
                allNotifications = [];
                renderNotifications();
                updateNotifBadge();
                showNotification('All notifications cleared');
            } catch (error) {
                showNotification('Failed to clear notifications', 'error');
            }
        }
    };

    // --- WARRANTY WALLET LOGIC ---
    let allWarranties = [];
    let currentWarrantyFilter = 'all';
    let warrantySearchQuery = '';

    const loadWarrantyWallet = async () => {
        const warrantyList = document.getElementById('warranty-list');
        if (!warrantyList) return;

        // Show loading state first
        warrantyList.innerHTML = `
            <div style="grid-column: span 3; text-align: center; padding: 100px; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 15px; display: block;"></i>
                Syncing your digital vault...
            </div>
        `;
        
        try {
            const [warrantiesRes, productsRes] = await Promise.all([
                api.warranties.getAll(),
                api.products.getAll()
            ]);

            allWarranties = warrantiesRes.data || [];
            const products = productsRes.data || [];

            console.log(`[WarrantyWallet] Loaded ${allWarranties.length} documents for ${products.length} products`);

            if (allWarranties.length === 0) {
                warrantyList.innerHTML = `
                    <div class="empty-state-view" style="grid-column: span 3; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px;">
                        <div class="empty-state-icon">
                            <i class="fas fa-wallet" style="opacity: 0.15; font-size: 4rem;"></i>
                        </div>
                        <h2>Your Wallet is Empty</h2>
                        <p>Securely store your warranty cards and bills here to receive automated alerts and AI service tips.</p>
                        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 25px;">
                            <button class="btn btn-primary" onclick="document.getElementById('upload-warranty-btn').click()" style="width: auto; min-width: 200px;">
                                <i class="fas fa-file-upload"></i> Upload First Document
                            </button>
                            <button class="btn" onclick="document.getElementById('nav-dashboard').click()" style="width: auto; background: rgba(0,0,0,0.05);">
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            renderWarranties(products);
        } catch (error) {
            console.error('[WarrantyWallet] Load failed:', error);
            showNotification('Could not sync wallet data. Please try again.', 'error');
            warrantyList.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 50px; color: var(--danger);">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 15px; display: block;"></i>
                Failed to sync wallet data.
            </div>`;
        }
    };

    const renderWarranties = (products) => {
        const warrantyList = document.getElementById('warranty-list');
        
        let filtered = allWarranties;

        // Apply Search
        if (warrantySearchQuery) {
            filtered = filtered.filter(w => {
                const product = products.find(p => p._id === w.productId);
                return product && product.name.toLowerCase().includes(warrantySearchQuery.toLowerCase());
            });
        }

        // Apply Status Filter
        const now = appTime;
        if (currentWarrantyFilter !== 'all') {
            filtered = filtered.filter(w => {
                const product = products.find(p => p._id === w.productId);
                if (!product) return false;
                
                const expiryDate = new Date(product.purchaseDate);
                expiryDate.setMonth(expiryDate.getMonth() + product.warrantyMonths);
                
                const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                
                if (currentWarrantyFilter === 'active') return diffDays > 30;
                if (currentWarrantyFilter === 'expiring') return diffDays <= 30 && diffDays >= 0;
                if (currentWarrantyFilter === 'expired') return diffDays < 0;
                return true;
            });
        }

        if (filtered.length === 0) {
            warrantyList.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 100px; color: var(--text-muted); opacity: 0.5;">
                <i class="fas fa-search" style="font-size: 2rem; display: block; margin-bottom: 15px;"></i>
                No documents match your search or filter.
            </div>`;
            return;
        }

        warrantyList.innerHTML = filtered.map(w => {
            const product = products.find(p => p._id === w.productId);
            return renderWarrantyCard(w, product);
        }).join('');
    };

    const renderWarrantyCard = (warranty, product) => {
        if (!product) return '';
        const now = appTime;
        const purchaseDate = new Date(product.purchaseDate);
        const expiryDate = new Date(purchaseDate);
        expiryDate.setMonth(expiryDate.getMonth() + product.warrantyMonths);
        
        const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        let statusClass = 'status-active';
        let statusLabel = 'Active';
        let countdownClass = 'countdown-active';
        let countdownText = `Expires in ${diffDays} days`;

        if (diffDays < 0) {
            statusClass = 'status-expired';
            statusLabel = 'Expired';
            countdownClass = 'countdown-expired';
            countdownText = `Expired ${Math.abs(diffDays)} days ago`;
        } else if (diffDays <= 30) {
            statusClass = 'status-expiring';
            statusLabel = 'Expiring Soon';
            countdownClass = 'countdown-expiring';
        }

        const iconMap = {
            'Electronics': 'fa-laptop',
            'Home Appliances': 'fa-plug',
            'Grocery': 'fa-shopping-basket',
            'Vehicles': 'fa-car',
            'Furniture': 'fa-couch',
            'IT Equipment': 'fa-server',
            'Medical': 'fa-heartbeat'
        };
        const categoryIcon = iconMap[product.category] || 'fa-box';

        // AI Insight Logic
        let aiTip = '';
        if (statusLabel === 'Expiring Soon') {
            aiTip = `Consider scheduling a preventive check-up for your ${product.name} before the warranty expires.`;
        } else if (statusLabel === 'Expired') {
            aiTip = `Warranty coverage ended. Keep regular maintenance logs to prevent high repair costs.`;
        } else {
            aiTip = `Coverage is healthy. Your ${warranty.uploadType} is secured in your digital vault.`;
        }

        return `
            <div class="warranty-card glass">
                <div class="warranty-card-header">
                    <div class="warranty-icon-bg">
                        <i class="fas ${categoryIcon}"></i>
                    </div>
                    <span class="warranty-status-badge ${statusClass}">${statusLabel}</span>
                </div>
                
                <div class="warranty-info">
                    <h3>${product.name}</h3>
                    <span class="category">${product.category} • ${warranty.uploadType.charAt(0).toUpperCase() + warranty.uploadType.slice(1)}</span>
                </div>

                <div class="warranty-dates">
                    <div class="date-row">
                        <span class="date-label">Purchase Date</span>
                        <span class="date-value">${purchaseDate.toLocaleDateString()}</span>
                    </div>
                    <div class="date-row">
                        <span class="date-label">Expiry Date</span>
                        <span class="date-value">${expiryDate.toLocaleDateString()}</span>
                    </div>
                </div>

                <div class="warranty-countdown ${countdownClass}">
                    <i class="fas ${diffDays < 0 ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
                    <span>${countdownText}</span>
                </div>

                <div class="warranty-ai-tip">
                    <i class="fas fa-brain"></i>
                    <span>${aiTip}</span>
                </div>

                <div class="warranty-actions">
                    <button class="btn btn-primary" onclick="openPreview('${warranty._id}')" style="flex: 1; font-size: 0.85rem; padding: 10px; min-width: 0;">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <a href="${warranty.documentUrl}" download class="btn" style="background: rgba(0,0,0,0.05); width: 44px; padding: 0; min-width: 44px;">
                        <i class="fas fa-download"></i>
                    </a>
                    <button class="btn btn-danger-outline" onclick="deleteWarrantyDoc('${warranty._id}')" style="width: 44px; padding: 0; min-width: 44px;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    };

    // Globals for preview/delete
    window.openPreview = (id) => {
        const warranty = allWarranties.find(w => w._id === id);
        if (!warranty) return;

        const previewModal = document.getElementById('preview-modal');
        const previewBody = document.getElementById('preview-body');
        const previewTitle = document.getElementById('preview-title');
        const downloadBtn = document.getElementById('download-doc-btn');
        const baseUrl = '';

        previewTitle.textContent = `${warranty.documentName}`;
        downloadBtn.href = `${baseUrl}${warranty.documentUrl}`;

        if (warranty.fileType.includes('pdf')) {
            previewBody.innerHTML = `<iframe src="${baseUrl}${warranty.documentUrl}" style="width: 100%; height: 100%;"></iframe>`;
        } else {
            previewBody.innerHTML = `<img src="${baseUrl}${warranty.documentUrl}" alt="Warranty Document" style="max-width: 100%; max-height: 100%; margin: auto; display: block;">`;
        }

        previewModal.style.display = 'flex';
    };

    window.deleteWarrantyDoc = async (id) => {
        const confirmed = await showConfirm('Delete Document?', 'Are you sure you want to remove this warranty document from your wallet?', 'danger');
        if (confirmed) {
            try {
                await api.warranties.delete(id);
                showNotification('Document removed');
                loadWarrantyWallet();
            } catch (error) {
                showNotification('Failed to delete document', 'error');
            }
        }
    };

    // Search & Filters
    document.getElementById('warranty-search').oninput = (e) => {
        warrantySearchQuery = e.target.value;
        api.products.getAll().then(res => renderWarranties(res.data));
    };

    document.querySelectorAll('[data-warranty-filter]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-warranty-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWarrantyFilter = btn.dataset.warrantyFilter;
            api.products.getAll().then(res => renderWarranties(res.data));
        };
    });

    // Upload Logic
    document.getElementById('upload-warranty-btn').onclick = async () => {
        const modal = document.getElementById('warranty-modal');
        const productOptions = document.getElementById('warranty-product-options');
        const selected = document.querySelector('#warranty-product-select-container .select-selected');
        
        try {
            const res = await api.products.getAll();
            const products = res.data;

            if (products.length === 0) {
                showNotification('Please add a product first', 'info');
                return;
            }

            productOptions.innerHTML = products.map(p => `
                <div data-value="${p._id}">${p.name}</div>
            `).join('');

            // Reset select
            selected.textContent = 'Select Product';
            document.getElementById('warranty-product-id').value = '';
            document.getElementById('selected-file-name').style.display = 'none';
            document.getElementById('warranty-upload-form').reset();

            // Re-init listeners for custom select
            productOptions.querySelectorAll('div').forEach(item => {
                item.onclick = function() {
                    selected.textContent = this.textContent;
                    document.getElementById('warranty-product-id').value = this.dataset.value;
                    productOptions.classList.add('select-hide');
                };
            });

            modal.style.display = 'flex';
        } catch (error) {
            showNotification('Failed to fetch products', 'error');
        }
    };

    document.getElementById('close-warranty-modal').onclick = () => {
        document.getElementById('warranty-modal').style.display = 'none';
    };

    document.getElementById('close-preview-modal').onclick = () => {
        document.getElementById('preview-modal').style.display = 'none';
    };

    // File Handling
    const dropZone = document.getElementById('document-drop-zone');
    const fileInput = document.getElementById('warranty-file-input');
    const fileNameSpan = document.getElementById('selected-file-name');

    dropZone.onclick = () => fileInput.click();

    const warrantyFileInfo = document.getElementById('warranty-file-info');
    const clearWarrantyFile = document.getElementById('clear-warranty-file');

    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            fileNameSpan.textContent = `Selected: ${e.target.files[0].name}`;
            warrantyFileInfo.style.display = 'flex';
            dropZone.querySelector('p').style.display = 'none';
            dropZone.querySelector('i').style.display = 'none';
        }
    };

    if (clearWarrantyFile) {
        clearWarrantyFile.onclick = (e) => {
            e.stopPropagation();
            fileInput.value = '';
            fileNameSpan.textContent = '';
            warrantyFileInfo.style.display = 'none';
            dropZone.querySelector('p').style.display = 'block';
            dropZone.querySelector('i').style.display = 'block';
        };
    }

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => dropZone.classList.remove('dragover');

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            fileNameSpan.textContent = `Selected: ${e.dataTransfer.files[0].name}`;
            warrantyFileInfo.style.display = 'flex';
            dropZone.querySelector('p').style.display = 'none';
            dropZone.querySelector('i').style.display = 'none';
        }
    };

    document.getElementById('warranty-upload-form').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-warranty-upload');
        const productId = document.getElementById('warranty-product-id').value;
        const uploadType = document.getElementById('warranty-upload-type').value;

        if (!productId) {
            showNotification('Please select a product', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('document', fileInput.files[0]);
        formData.append('productId', productId);
        formData.append('uploadType', uploadType);

        try {
            submitBtn.textContent = 'Uploading...';
            submitBtn.disabled = true;

            await api.warranties.upload(formData);
            
            showNotification('Warranty document secured!');
            document.getElementById('warranty-modal').style.display = 'none';
            loadWarrantyWallet();
        } catch (error) {
            showNotification(error.message || 'Upload failed', 'error');
        } finally {
            submitBtn.textContent = 'Start Upload';
            submitBtn.disabled = false;
        }
    };

    // Initial Load
    loadDashboard();
    api.warranties.getAll().then(res => allWarranties = res.data);
    loadNotifications(false); // Load in background to show badge

});

