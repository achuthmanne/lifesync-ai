# LifeSync AI - Smart Product Lifecycle Platform

LifeSync AI is a production-level full-stack web application designed to track product lifecycles, predict failures using AI, and provide intelligent maintenance recommendations.

## 🚀 Features
- **AI-Powered Predictions**: Uses Gemini/OpenAI to predict failure timelines and suggest maintenance.
- **Dynamic Lifecycle Tracking**: Automatically calculates stages from "New" to "End-of-life".
- **Real-Time Updates**: Socket.io integration for instant dashboard updates and notifications.
- **Premium UI**: Modern dark-mode interface with glassmorphism and smooth animations.
- **AI Chat Assistant**: Interactive help for product-specific queries and health checks.

## 🏗️ Tech Stack
- **Frontend**: Vanilla JS, Modern CSS (Glassmorphism), Chart.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **AI**: Google Gemini API / OpenAI API

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js installed
- MongoDB running locally or a MongoDB Atlas URI

### 2. Installation
1. Clone the project.
2. Navigate to the root directory.
3. Install dependencies:
   ```bash
   npm install
   ```

### 3. Environment Configuration
Create a `.env` file in the root (already provided in the workspace) and add your API keys:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Running the Application
Start the server (and the client via static serving):
```bash
npm run dev
```
The application will be available at `http://localhost:5000`.

## 📂 Folder Structure
- `client/`: Frontend assets (HTML, CSS, JS)
- `server/`: Backend source code
- `server/models/`: Database schemas
- `server/controllers/`: Logic for API endpoints
- `server/services/`: AI logic integration
- `server/sockets/`: Real-time handlers
