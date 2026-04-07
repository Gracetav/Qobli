const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error_msg', 'Silakan login terlebih dahulu!');
    res.redirect('/auth/login');
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'Anda tidak memiliki akses ke halaman ini!');
    res.redirect('/');
};

const isUser = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'user') {
        return next();
    }
    req.flash('error_msg', 'Akses khusus untuk pembeli!');
    res.redirect('/');
};

module.exports = { isLoggedIn, isAdmin, isUser };
