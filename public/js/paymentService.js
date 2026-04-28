/**
 * LifeSync AI Payment Service
 * Production-grade Razorpay Integration
 */

const PaymentService = {
    config: null,

    async init() {
        try {
            const res = await fetch('/api/payments/config');
            const data = await res.json();
            if (data.success) {
                this.config = data.key;
            }
        } catch (error) {
            console.error('Failed to load payment config:', error);
        }
    },

    async handleUpgrade(plan) {
        const modal = document.getElementById('billing-confirmation-modal');
        const loader = document.getElementById('billing-loader');
        const btn = document.getElementById('billing-confirm-btn');
        const planNameDisp = document.getElementById('billing-plan-title');
        const planPriceDisp = document.getElementById('billing-plan-amount');
        const planFeaturesDisp = document.getElementById('billing-plan-features');

        // Plan Details Configuration
        const plans = {
            pro: {
                title: 'Pro Plan',
                price: '499',
                features: ['100 Product Slots', '200 AI Analysis/mo', '1GB Secure Storage', 'Priority AI Engine']
            },
            premium: {
                title: 'Premium Plan',
                price: '999',
                features: ['Unlimited Products', 'Unlimited AI Analysis', '10GB Secure Storage', 'Advanced PDF Reports']
            }
        };

        const selected = plans[plan];
        if (!selected) return;

        // Populate Modal
        planNameDisp.textContent = selected.title;
        planPriceDisp.innerHTML = `₹${selected.price}<span>/lifetime</span>`;
        planFeaturesDisp.innerHTML = selected.features.map(f => `
            <div class="billing-feature-item">
                <i class="fas fa-check-circle"></i>
                <span>${f}</span>
            </div>
        `).join('');

        // Show Modal
        modal.style.display = 'flex';

        // Bind Confirm Action
        btn.onclick = async () => {
            btn.disabled = true;
            loader.style.display = 'block';
            
            try {
                await this.executePayment(plan);
            } catch (err) {
                this.showFeedback('error', 'Payment Initialization Failed');
            } finally {
                btn.disabled = false;
                loader.style.display = 'none';
            }
        };
    },

    async executePayment(plan) {
        try {
            // 1. Create Order
            const orderRes = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ plan })
            });
            const orderData = await orderRes.json();
            
            if (!orderData.success) throw new Error(orderData.message);

            const user = JSON.parse(localStorage.getItem('user'));

            // 2. Razorpay Options
            const options = {
                key: this.config,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: 'LifeSync AI',
                description: `Upgrade to ${plan.toUpperCase()}`,
                image: '/img/logo-blue.png', // Ensure this exists or use a generic icon
                order_id: orderData.order.id,
                handler: async (response) => {
                    await this.verifyPayment(response, plan);
                },
                prefill: {
                    name: user.name,
                    email: user.email,
                },
                notes: {
                    userId: user._id,
                    plan: plan
                },
                theme: {
                    color: '#2563eb'
                },
                modal: {
                    ondismiss: () => {
                        this.showFeedback('info', 'Payment cancelled by user');
                    }
                }
            };

            const rzp = new Razorpay(options);
            rzp.open();
            
            // Hide confirmation modal once checkout opens
            document.getElementById('billing-confirmation-modal').style.display = 'none';

        } catch (error) {
            throw error;
        }
    },

    async verifyPayment(paymentResponse, plan) {
        try {
            const res = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    razorpay_order_id: paymentResponse.razorpay_order_id,
                    razorpay_payment_id: paymentResponse.razorpay_payment_id,
                    razorpay_signature: paymentResponse.razorpay_signature,
                    plan: plan
                })
            });

            const data = await res.json();
            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.data));
                this.showFeedback('success', `${plan.toUpperCase()} Activated!`);
                
                // Refresh Dashboard
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                this.showFeedback('error', 'Signature Verification Failed');
            }
        } catch (error) {
            this.showFeedback('error', 'Verification Connection Error');
        }
    },

    showFeedback(type, message) {
        const feedback = document.getElementById('payment-feedback-modal');
        const icon = feedback.querySelector('.payment-feedback-icon');
        const msg = feedback.querySelector('h3');

        feedback.style.display = 'block';
        msg.textContent = message;

        if (type === 'success') {
            icon.innerHTML = '<i class="fas fa-check-circle payment-success-icon"></i>';
        } else if (type === 'error') {
            icon.innerHTML = '<i class="fas fa-times-circle payment-error-icon"></i>';
        } else {
            icon.innerHTML = '<i class="fas fa-info-circle" style="color: #3b82f6"></i>';
        }

        setTimeout(() => {
            feedback.style.display = 'none';
        }, 3000);
    }
};

// Initialize on load
window.PaymentService = PaymentService;
PaymentService.init();

window.closeBillingModal = () => {
    document.getElementById('billing-confirmation-modal').style.display = 'none';
};
