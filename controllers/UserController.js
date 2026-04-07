const getProducts = async (req, res) => {
    try {
        const [rows] = await global.db.query('SELECT * FROM products');
        res.render('index', { products: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getProductDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await global.db.query('SELECT * FROM products WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).send('Produk tidak ditemukan');
        res.render('user/product_detail', { product: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const addToCart = async (req, res) => {
    const { product_id, qty } = req.body;
    let cart = req.session.cart || [];
    
    // Check if product exists in cart
    const existingIndex = cart.findIndex(item => item.product_id == product_id);
    if (existingIndex > -1) {
        cart[existingIndex].qty += parseInt(qty);
    } else {
        const [rows] = await global.db.query('SELECT * FROM products WHERE id = ?', [product_id]);
        if (rows.length > 0) {
            const product = rows[0];
            cart.push({
                product_id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                qty: parseInt(qty)
            });
        }
    }
    
    req.session.cart = cart;
    req.flash('success_msg', 'Produk ditambahkan ke keranjang!');
    res.redirect('/');
};

const getCart = (req, res) => {
    const cart = req.session.cart || [];
    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    res.render('user/cart', { cart, total });
};

const removeFromCart = (req, res) => {
    const { id } = req.params;
    let cart = req.session.cart || [];
    req.session.cart = cart.filter(item => item.product_id != id);
    res.redirect('/user/cart');
};

const checkout = async (req, res) => {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/');
    
    const total_price = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const user_id = req.session.user.id;
    
    try {
        // Start transaction
        const connection = await global.db.getConnection();
        await connection.beginTransaction();
        
        try {
            const [orderResult] = await connection.query('INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, "pending")', 
                [user_id, total_price]);
            const order_id = orderResult.insertId;
            
            for (let item of cart) {
                await connection.query('INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)', 
                    [order_id, item.product_id, item.qty, item.price]);
                
                // Update stock
                await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.product_id]);
            }
            
            await connection.commit();
            req.session.cart = [];
            req.flash('success_msg', 'Pesanan berhasil dibuat! Silakan upload bukti transfer.');
            res.redirect('/user/orders/' + order_id);
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error during checkout');
    }
};

const getOrders = async (req, res) => {
    const user_id = req.session.user.id;
    try {
        const [rows] = await global.db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
        res.render('user/orders/index', { orders: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getOrderDetail = async (req, res) => {
    const { id } = req.params;
    const user_id = req.session.user.id;
    try {
        const [order] = await global.db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, user_id]);
        if (order.length === 0) return res.status(404).send('Pesanan tidak ditemukan');
        
        const [items] = await global.db.query(`
            SELECT order_items.*, products.name, products.image 
            FROM order_items 
            JOIN products ON order_items.product_id = products.id 
            WHERE order_id = ?`, [id]);
        
        const [payment] = await global.db.query('SELECT * FROM payments WHERE order_id = ?', [id]);
        
        res.render('user/orders/detail', { 
            order: order[0], 
            items: items, 
            payment: payment[0] || null 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const uploadPayment = async (req, res) => {
    const { order_id } = req.body;
    const proof = req.file ? req.file.filename : null;
    if (!proof) {
        req.flash('error_msg', 'Silakan masukkan bukti transfer!');
        return res.redirect('/user/orders/' + order_id);
    }
    
    try {
        // check if payment already exists
        const [existing] = await global.db.query('SELECT * FROM payments WHERE order_id = ?', [order_id]);
        if (existing.length > 0) {
            await global.db.query('UPDATE payments SET proof = ?, status = "pending" WHERE order_id = ?', [proof, order_id]);
        } else {
            await global.db.query('INSERT INTO payments (order_id, proof, status) VALUES (?, ?, "pending")', [order_id, proof]);
        }
        
        req.flash('success_msg', 'Bukti transfer berhasil diupload! Menunggu konfirmasi admin.');
        res.redirect('/user/orders/' + order_id);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

module.exports = { 
    getProducts, getProductDetail, addToCart, getCart, removeFromCart, 
    checkout, getOrders, getOrderDetail, uploadPayment 
};
