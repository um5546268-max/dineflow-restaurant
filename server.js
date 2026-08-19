const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: ['http://localhost:5000', 'https://*.onrender.com', 'https://*.railway.app', '*'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));

// ============================================
// SESSION
// ============================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'dineflow-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// ============================================
// USERS DATABASE
// ============================================
const users = [];
let orders = [];
let menuItems = [
    { id: 1, name: 'Cheese Burger', price: 12.99, category: 'burgers', icon: '🍔' },
    { id: 2, name: 'Double Burger', price: 15.99, category: 'burgers', icon: '🍔' },
    { id: 3, name: 'Chicken Burger', price: 11.99, category: 'burgers', icon: '🍔' },
    { id: 4, name: 'Margherita Pizza', price: 14.99, category: 'pizza', icon: '🍕' },
    { id: 5, name: 'Pepperoni Pizza', price: 16.99, category: 'pizza', icon: '🍕' },
    { id: 6, name: 'BBQ Chicken Pizza', price: 17.99, category: 'pizza', icon: '🍕' },
    { id: 7, name: 'Chicken Sandwich', price: 10.99, category: 'sandwiches', icon: '🥪' },
    { id: 8, name: 'Club Sandwich', price: 11.99, category: 'sandwiches', icon: '🥪' },
    { id: 9, name: 'French Fries', price: 4.99, category: 'sides', icon: '🍟' },
    { id: 10, name: 'Onion Rings', price: 5.99, category: 'sides', icon: '🧅' },
    { id: 11, name: 'Chocolate Shake', price: 5.99, category: 'drinks', icon: '🥤' },
    { id: 12, name: 'Iced Tea', price: 3.99, category: 'drinks', icon: '🧋' }
];

// ============================================
// GOOGLE OAUTH
// ============================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    let user = users.find(u => u.googleId === profile.id);
    if (!user) {
        user = {
            id: users.length + 1,
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            photo: profile.photos[0].value,
            role: users.length === 0 ? 'admin' : 'customer'
        };
        users.push(user);
        console.log(`✅ New user: ${user.displayName} (${user.role})`);
    }
    return done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    const user = users.find(u => u.id === id);
    done(null, user);
});

// ============================================
// ⭐ GOOGLE AUTH ROUTES - COMPLETE ⭐
// ============================================

// 1. Start Google login
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. ⭐ CRITICAL: Google redirects here after login
app.get('/callback',
    passport.authenticate('google', { failureRedirect: '/login-failed' }),
    function(req, res) {
        // Save session and redirect based on role
        req.session.save(function(err) {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/login-failed');
            }
            if (req.user && req.user.role === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/');
            }
        });
    }
);

// 3. Login failed page
app.get('/login-failed', (req, res) => {
    res.send(`
        <h1>❌ Login Failed</h1>
        <p>Please try again.</p>
        <a href="/auth/google">Try Again</a>
        <a href="/">Home</a>
    `);
});

// 4. Logout
app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Error during logout');
        }
        req.session.destroy(function(err) {
            if (err) {
                console.error('Session destroy error:', err);
            }
            res.redirect('/');
        });
    });
});

// ============================================
// API ROUTES
// ============================================
app.get('/api/user/profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: req.user });
});

app.get('/api/menu', (req, res) => {
    res.json(menuItems);
});

app.post('/api/orders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const { items, total, name, phone, address } = req.body;
    if (!items || !items.length || !total) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const newOrder = {
        id: orders.length + 1,
        userId: req.user.id,
        userName: name || req.user.displayName,
        phone: phone || '',
        address: address || 'In-store pickup',
        items: items,
        total: parseFloat(total),
        status: 'pending',
        date: new Date().toLocaleString()
    };
    orders.push(newOrder);
    res.status(201).json({ message: 'Order placed', order: newOrder });
});

app.get('/api/orders/myorders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const userOrders = orders.filter(o => o.userId === req.user.id);
    res.json(userOrders);
});

app.get('/api/orders/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json(orders);
});

app.put('/api/orders/:id/status', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    order.status = status;
    res.json({ success: true, order });
});

// ============================================
// ⭐ SERVE HTML PAGES ⭐
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'admin.html'));
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🍔 DINEFLOW SERVER RUNNING');
    console.log('========================================');
    console.log(`📱 Customer: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
    console.log('========================================');
    console.log(`🔑 Google Auth: http://localhost:${PORT}/auth/google`);
    console.log(`🔑 Callback: http://localhost:${PORT}/callback`);
    console.log('========================================');
    console.log('✅ Server is ready!');
    console.log(`📊 Users: ${users.length}`);
    console.log(`📦 Orders: ${orders.length}`);
    console.log('========================================');
});

module.exports = app;