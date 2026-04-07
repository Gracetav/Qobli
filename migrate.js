require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function migrate() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
    };

    const databaseName = process.env.DB_NAME || 'pusat_sparepart_oi';

    try {
        console.log('Connecting to MySQL...');
        const connection = await mysql.createConnection(config);

        console.log(`Creating database ${databaseName}...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
        await connection.end();

        console.log('Connecting to the database...');
        const db = await mysql.createConnection({ ...config, database: databaseName });

        console.log('Creating tables...');
        
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
                status ENUM('pending', 'paid', 'shipped', 'completed', 'rejected') DEFAULT 'pending',
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

        // Check for Admin
        const [rows] = await db.query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
        if (rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "admin")', 
                ['Admin OI', 'admin@oi.com', hashedPassword]);
            console.log('Admin seeded: admin@oi.com / admin123');
        }

        console.log('Migration completed successfully!');
        await db.end();
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
