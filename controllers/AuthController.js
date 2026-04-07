const bcrypt = require('bcrypt');

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await global.db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            req.flash('error_msg', 'Email tidak terdaftar!');
            return res.redirect('/auth/login');
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash('error_msg', 'Password salah!');
            return res.redirect('/auth/login');
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [existing] = await global.db.query('SELECT email FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            req.flash('error_msg', 'Email sudah terdaftar!');
            return res.redirect('/auth/register');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await global.db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "user")', 
            [name, email, hashedPassword]);

        req.flash('success_msg', 'Registrasi berhasil! Silakan login.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const logout = (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
};

module.exports = { login, register, logout };
