const mongoose = require('mongoose');

const WarrantySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    documentUrl: {
        type: String,
        required: true
    },
    documentName: {
        type: String,
        required: true
    },
    uploadType: {
        type: String,
        enum: ['bill', 'warranty', 'manual', 'other'],
        default: 'warranty'
    },
    fileType: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Warranty', WarrantySchema);
