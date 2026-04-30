const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { isLoggedIn, isUser } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/payments'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/products/:id', userController.getProductDetail);
router.post('/cart/add', isLoggedIn, userController.addToCart);
router.get('/cart', userController.getCart);
router.get('/cart/remove/:id', userController.removeFromCart);

router.post('/checkout', isLoggedIn, isUser, userController.checkout);
router.get('/orders', isLoggedIn, isUser, userController.getOrders);
router.get('/orders/:id', isLoggedIn, isUser, userController.getOrderDetail);
router.post('/orders/upload-payment', isLoggedIn, isUser, upload.single('proof'), userController.uploadPayment);
router.get('/orders/cancel/:id', isLoggedIn, isUser, userController.cancelOrder);

module.exports = router;
