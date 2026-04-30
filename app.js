require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pusat_sparepart_oi'
};

console.log('--- Database Config Debug ---');
console.log('Host:', dbConfig.host);
console.log('User:', dbConfig.user);
console.log('Password set:', dbConfig.password ? 'YES' : 'NO (Empty)');
console.log('Database:', dbConfig.database);
console.log('-----------------------------');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
    res.locals.formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value);
    };
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
    next();
});

// Database Connection & Migration Logic
async function initDB() {
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        await connection.end();

        const db = await mysql.createPool(dbConfig);
        console.log('Database connected!');

        // Create Tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'user') DEFAULT 'user'
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                stock INT DEFAULT 0,
                description TEXT,
                image VARCHAR(255)
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                total_price DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'paid', 'shipped', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                product_id INT,
                qty INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                proof VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        // Update ENUM if it already exists
        await db.query(`
            ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'paid', 'shipped', 'completed', 'rejected', 'cancelled') DEFAULT 'pending'
        `).catch(err => console.log('Enum update status:', err.message));

        // Initial Admin Check
        const [rows] = await db.query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
        if (rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', 
                ['Admin OI', 'admin@oi.com', hashedPassword, 'admin']);
            console.log('Seeded initial admin account: admin@oi.com / admin123');
        }

        global.db = db;
    } catch (err) {
        console.error('Database Init Error:', err);
        process.exit(1);
    }
}

initDB().then(() => {
    // Routes initialization
    const authRoutes = require('./routes/auth');
    const userRoutes = require('./routes/user');
    const adminRoutes = require('./routes/admin');
    const indexRoutes = require('./routes/index');

    app.use('/', indexRoutes);
    app.use('/auth', authRoutes);
    app.use('/user', userRoutes);
    app.use('/admin', adminRoutes);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
