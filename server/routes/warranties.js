const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Warranty = require('../models/Warranty');
const Product = require('../models/Product');

// Configure Multer for storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'server/uploads/warranties';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDFs are allowed'));
    }
});

// @route   GET /api/warranties
// @desc    Get all warranties for user
// @access  Private
router.get('/', auth.protect, async (req, res) => {
    try {
        const warranties = await Warranty.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, data: warranties });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/warranties/upload
// @desc    Upload warranty document
// @access  Private
router.post('/upload', auth.protect, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { productId, uploadType } = req.body;
        
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Check if product exists and belongs to user
        const product = await Product.findOne({ _id: productId, user: req.user.id });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const newWarranty = new Warranty({
            userId: req.user.id,
            productId,
            documentUrl: `/uploads/warranties/${req.file.filename}`,
            documentName: req.file.originalname,
            uploadType: uploadType || 'warranty',
            fileType: req.file.mimetype
        });

        await newWarranty.save();

        res.json({ 
            success: true, 
            message: 'Document uploaded successfully', 
            data: newWarranty 
        });
    } catch (err) {
        console.error('Upload Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

// @route   DELETE /api/warranties/:id
// @desc    Delete warranty document
// @access  Private
router.delete('/:id', auth.protect, async (req, res) => {
    try {
        const warranty = await Warranty.findOne({ _id: req.params.id, userId: req.user.id });
        
        if (!warranty) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        // Delete physical file
        const filePath = path.join(__dirname, '..', '..', 'server', warranty.documentUrl.startsWith('/') ? warranty.documentUrl.substring(1) : warranty.documentUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Warranty.deleteOne({ _id: req.params.id });
        
        res.json({ success: true, message: 'Document deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
