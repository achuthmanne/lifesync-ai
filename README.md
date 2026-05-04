# ⚡ LifeSync AI
> Intelligent product lifecycle management powered by multi-engine AI. Track, manage, and extend the life of your physical assets effortlessly.

---

## 📖 Overview
**LifeSync AI** is a modern, SaaS-style web application designed to bridge the gap between physical products and digital intelligence. It allows users to track their physical inventory, securely store warranties, and receive proactive, AI-generated insights regarding product health, maintenance, and failure probabilities. 

Whether you're managing expensive electronics, home appliances, or professional gear, LifeSync AI ensures you never miss a warranty expiration and always know when it's time for maintenance.

---

## ✨ Features

- 📦 **Smart Product Management:** Easily add and categorize products. Supports advanced AI Barcode Detection to instantly identify product models and specs via computer vision.
- 🛡️ **Warranty Wallet:** A secure, encrypted digital vault for all your warranty documents, PDFs, and purchase receipts.
- 🧠 **Deep AI Analytics:** Get real-time health assessments, risk distribution charts, and predictive maintenance forecasts powered by a multi-engine AI fallback system.
- 🔔 **Proactive Notifications:** Receive timely, automated alerts before warranties expire or when a product enters a high-risk failure window.
- 💬 **AI Diagnostic Chat:** A built-in, cross-platform AI assistant that provides instant troubleshooting and custom care instructions based on your specific inventory.

---

## 💎 Pricing Model
LifeSync AI offers flexible tiers tailored to both individuals and power users:

| Tier | Price | Features |
| --- | --- | --- |
| **Free** | ₹0/mo | Up to 5 Products, 10 AI Requests/mo, Basic Analytics, 50MB Storage. |
| **Pro** | ₹499/mo | Up to 100 Products, 200 AI Requests/mo, Advanced Analytics, 1GB Storage, Priority Alerts. |
| **Premium** | ₹999/mo | Unlimited Products, Unlimited AI Requests, Deep AI Predictions, 10GB Storage, PDF Exports. |

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5 & CSS3 (Custom Glassmorphism UI)
- Vanilla JavaScript
- Chart.js (Data Visualization)
- QuaggaJS (Client-side Barcode Scanning)

**Backend:**
- Node.js & Express.js
- Socket.io (Real-time updates)
- Mongoose ODM

**Database & Cloud:**
- MongoDB Atlas
- Hosted on Render

**AI Integrations (Fallback Architecture):**
- Google Gemini (`gemini-1.5-flash`)
- Groq (`llama-3.1` & `llama-3.2-vision`)
- OpenAI (`gpt-4o-mini`)
- Cohere (`command-r`)

---

## 🚀 Installation & Setup

Want to run LifeSync AI locally? Follow these steps:

### 1. Clone the Repository
```bash
git clone https://github.com/achuthmanne/lifesync-ai.git
cd lifesync-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and add the following keys (see the Environment Variables section below):
```bash
touch .env
```

### 4. Run the Application
```bash
# Start the development server
npm start
```
The app will be running at `http://localhost:5000`.

---

## 🔑 Environment Variables

To run this application, you must configure the required environment variables in a `.env` file.

⚠️ **Important:**

* Never commit your `.env` file to GitHub
* Never expose API keys or secrets publicly

| Variable         | Description                                  |
| ---------------- | -------------------------------------------- |
| `MONGO_URI`      | Your MongoDB Atlas connection string         |
| `JWT_SECRET`     | Secure string for signing JSON Web Tokens    |
| `GEMINI_API_KEY` | API key for AI services                      |
| `GROQ_API_KEY`   | API key for fallback AI services             |
| `OPENAI_API_KEY` | API key for additional AI support            |
| `EMAIL_USER`     | SMTP email address for sending notifications |
| `EMAIL_PASSWORD` | SMTP app password for the email service      |

*(Note: The system includes a fallback mechanism — if one AI service is unavailable or rate-limited, it automatically switches to another available provider.)*

---

### 🛡️ Security Note

All sensitive credentials must be stored securely using environment variables.  
Do **not** hardcode or share any API keys in public repositories.

---

### 📁 Example `.env` (Do NOT use real values)

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_random_string

GEMINI_API_KEY=your_api_key
GROQ_API_KEY=your_api_key
OPENAI_API_KEY=your_api_key

EMAIL_USER=your_email_address
EMAIL_PASSWORD=your_email_app_password
```

## ☁️ Deployment

LifeSync AI is optimized for deployment on **Render**. 
1. Connect your GitHub repository to Render as a "Web Service".
2. Set the Build Command to `npm install`.
3. Set the Start Command to `npm start`.
4. Copy your local `.env` variables into the Render Environment Variables dashboard.
5. Deploy!

---

## 🔮 Future Improvements

- **💳 Payment Gateway Integration:** Implement Stripe or Razorpay to handle automated subscription billing for Pro/Premium tiers.
- **📊 Advanced PDF Reporting:** Allow Premium users to generate and export highly detailed inventory health reports.
- **📱 Native Mobile App:** Port the responsive web view into a React Native application for iOS/Android.
- **💱 Multi-Currency Support:** Dynamically adjust pricing based on user geolocation.

---

## 👨‍💻 Author

**Achuth Chowdary**  
*Aspiring Full Stack Developer & AI Enthusiast*  
Passionate about building scalable, intelligent systems that solve real-world problems. 

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute the code as you see fit.

---

## 🤝 Contributing & Support

If you found this project helpful or interesting, please consider giving it a ⭐ on GitHub! 

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
