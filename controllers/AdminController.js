const dashboard = async (req, res) => {
    try {
        const [users] = await global.db.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const [products] = await global.db.query('SELECT COUNT(*) as count FROM products');
        const [orders] = await global.db.query('SELECT COUNT(*) as count FROM orders');
        res.render('admin/dashboard', {
            stats: { 
                users: users[0].count, 
                products: products[0].count, 
                orders: orders[0].count 
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getProducts = async (req, res) => {
    try {
        const [rows] = await global.db.query('SELECT * FROM products');
        res.render('admin/products/index', { products: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const addProduct = async (req, res) => {
    const { name, price, stock, description } = req.body;
    const image = req.file ? req.file.filename : null;
    try {
        await global.db.query('INSERT INTO products (name, price, stock, description, image) VALUES (?, ?, ?, ?, ?)', 
            [name, price, stock, description, image]);
        req.flash('success_msg', 'Produk berhasil ditambahkan!');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, price, stock, description } = req.body;
    const [existing] = await global.db.query('SELECT image FROM products WHERE id = ?', [id]);
    const image = req.file ? req.file.filename : existing[0].image;

    try {
        await global.db.query('UPDATE products SET name = ?, price = ?, stock = ?, description = ?, image = ? WHERE id = ?', 
            [name, price, stock, description, image, id]);
        req.flash('success_msg', 'Produk berhasil diupdate!');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await global.db.query('DELETE FROM products WHERE id = ?', [id]);
        req.flash('success_msg', 'Produk berhasil dihapus!');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getUsers = async (req, res) => {
    try {
        const [rows] = await global.db.query('SELECT * FROM users WHERE role = "user"');
        res.render('admin/users/index', { users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await global.db.query('DELETE FROM users WHERE id = ?', [id]);
        req.flash('success_msg', 'User berhasil dihapus!');
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getOrders = async (req, res) => {
    try {
        const [rows] = await global.db.query(`
            SELECT orders.*, users.name as user_name 
            FROM orders 
            JOIN users ON orders.user_id = users.id 
            ORDER BY orders.created_at DESC
        `);
        res.render('admin/orders/index', { orders: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const getOrderDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const [order] = await global.db.query(`
            SELECT orders.*, users.name as user_name, users.email as user_email
            FROM orders 
            JOIN users ON orders.user_id = users.id 
            WHERE orders.id = ?`, [id]);
        
        const [items] = await global.db.query(`
            SELECT order_items.*, products.name as product_name, products.image as product_image
            FROM order_items 
            JOIN products ON order_items.product_id = products.id 
            WHERE order_items.order_id = ?`, [id]);
        
        const [payment] = await global.db.query('SELECT * FROM payments WHERE order_id = ?', [id]);

        res.render('admin/orders/detail', { 
            order: order[0], 
            items: items, 
            payment: payment[0] || null 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const connection = await global.db.getConnection();
        await connection.beginTransaction();
        
        try {
            const [orders] = await connection.query('SELECT status FROM orders WHERE id = ?', [id]);
            if (orders.length === 0) {
                connection.release();
                return res.status(404).send('Pesanan tidak ditemukan');
            }
            
            const oldStatus = orders[0].status;
            const returnStockStatuses = ['rejected', 'cancelled'];
            
            // If changing TO a return-stock status from a non-return-stock status
            if (!returnStockStatuses.includes(oldStatus) && returnStockStatuses.includes(status)) {
                const [items] = await connection.query('SELECT product_id, qty FROM order_items WHERE order_id = ?', [id]);
                for (let item of items) {
                    await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id]);
                }
            } 
            // If changing FROM a return-stock status to a non-return-stock status
            else if (returnStockStatuses.includes(oldStatus) && !returnStockStatuses.includes(status)) {
                const [items] = await connection.query('SELECT product_id, qty FROM order_items WHERE order_id = ?', [id]);
                for (let item of items) {
                    await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.product_id]);
                }
            }

            await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
            await connection.commit();
            
            req.flash('success_msg', 'Status pesanan berhasil diupdate!');
            res.redirect('/admin/orders/' + id);
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

module.exports = { 
    dashboard, getProducts, addProduct, updateProduct, deleteProduct, 
    getUsers, deleteUser, getOrders, getOrderDetail, updateOrderStatus 
};
