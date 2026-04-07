const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');
const { isAdmin } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/products'),
    filename: (req, file, cb) => cb(null, 'product-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(isAdmin); // Protect all admin routes

router.get('/dashboard', adminController.dashboard);

router.get('/products', adminController.getProducts);
router.post('/products/add', upload.single('image'), adminController.addProduct);
router.post('/products/edit/:id', upload.single('image'), adminController.updateProduct);
router.get('/products/delete/:id', adminController.deleteProduct);

router.get('/users', adminController.getUsers);
router.get('/users/delete/:id', adminController.deleteUser);

router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetail);
router.post('/orders/:id/status', adminController.updateOrderStatus);

module.exports = router;
