const express = require('express');
const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    identifyProduct
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { checkLimit } = require('../middleware/limitMiddleware');

const router = express.Router();

router.use(protect);

router.post('/identify', upload.single('barcode'), identifyProduct);

router.route('/')
    .get(getProducts)
    .post(checkLimit('products'), createProduct);

router.route('/:id')
    .get(getProduct)
    .put(updateProduct)
    .delete(deleteProduct);

module.exports = router;
