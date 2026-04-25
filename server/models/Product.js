const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Please add a category']
    },
    brand: {
        type: String,
        trim: true
    },

    purchaseDate: {
        type: Date,
        required: [true, 'Please add a purchase date']
    },
    warrantyMonths: {
        type: Number,
        required: [true, 'Please add warranty period in months']
    },
    dailyUsageHours: {
        type: Number,
        default: 0
    },
    condition: {
        type: String,
        enum: ['new', 'good', 'moderate', 'poor'],
        default: 'new'
    },
    lifecycleStage: {
        type: String,
        enum: ['New', 'Active', 'Maintenance', 'Critical', 'End-of-life'],
        default: 'New'
    },
    healthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    failureProbability: {
        type: Number,
        default: 0
    },
    aiInsights: {
        riskLevel: {
            type: String,
            enum: ['Low', 'Medium', 'High'],
            default: 'Low'
        },
        failurePrediction: String,
        maintenanceTips: [String],
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        provider: {
            type: String,
            enum: ['OpenAI', 'Gemini', 'Groq', 'Cohere', 'Mock Engine', 'Offline', 'Local Engine'],
            default: 'Gemini'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('Product', productSchema);
