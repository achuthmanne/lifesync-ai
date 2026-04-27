const Product = require('../models/Product');
const aiService = require('../services/aiService');
const notificationService = require('../services/notificationService');
const monitoringService = require('../services/monitoringService');
const timeService = require('../services/timeService');
const User = require('../models/User');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ user: req.user.id });
        const enrichedProducts = products.map(p => monitoringService.enrichProductData(p));
        res.status(200).json({ 
            success: true, 
            count: products.length, 
            data: enrichedProducts,
            currentTime: timeService.getCurrentTime()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, user: req.user.id });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.status(200).json({ 
            success: true, 
            data: monitoringService.enrichProductData(product),
            currentTime: timeService.getCurrentTime()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res) => {
    try {
        req.body.user = req.user.id;
        const product = await Product.create(req.body);
        
        // Update user usage
        await User.findByIdAndUpdate(req.user.id, { $inc: { 'usage.products': 1 } });
        
        // Trigger AI analysis asynchronously for immediate UI feedback
        aiService.analyzeProduct(product.id).catch(err => console.error('AI Analysis Error:', err));

        // Create notification
        await notificationService.createNotification({
            user: req.user.id,
            title: 'Product Added',
            message: `Your ${product.name} has been added to LifeSync. AI analysis is underway.`,
            type: 'info',
            category: 'system',
            productId: product.id
        });

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        console.error('Create product error:', error.stack || error);
        res.status(500).json({ success: false, message: error.message, stack: error.stack });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res) => {
    try {
        let product = await Product.findOne({ _id: req.params.id, user: req.user.id });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Re-trigger AI analysis
        aiService.analyzeProduct(product.id).catch(err => console.error('AI Analysis Error:', err));

        // Create notification
        await notificationService.createNotification({
            user: req.user.id,
            title: 'Product Updated',
            message: `The details for ${product.name} have been updated. Re-analyzing lifecycle...`,
            type: 'info',
            category: 'system',
            productId: product.id
        });

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, user: req.user.id });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        await product.deleteOne();
        // Update user usage
        await User.findByIdAndUpdate(req.user.id, { $inc: { 'usage.products': -1 } });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Identify product from barcode/image
// @route   POST /api/products/identify
// @access  Private
exports.identifyProduct = async (req, res) => {
    try {
        let barcodeNumber = req.body.barcode || req.body.barcodeNumber || null;
        if (barcodeNumber) {
            barcodeNumber = barcodeNumber.toString().replace(/\D/g, '');
        }
        const imageBuffer = req.file ? req.file.buffer : null;
        const mimeType = req.file ? req.file.mimetype : 'image/jpeg';

        console.log(`[Identify] Req: barcode=${barcodeNumber}, hasImage=${!!imageBuffer}`);

        if (!imageBuffer && !barcodeNumber) {
            return res.status(400).json({ success: false, message: 'No image or barcode provided' });
        }

        const productData = await aiService.identifyProductFromImage(imageBuffer, mimeType, barcodeNumber);
        
        res.status(200).json({
            success: true,
            data: productData
        });
    } catch (error) {
        console.error('Identification Error:', error.message, error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'AI could not identify this product.',
            error: error.message 
        });
    }
};
