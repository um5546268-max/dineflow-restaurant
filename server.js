const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));

// Session
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

// Users
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

// Google OAuth
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

// ⭐ GOOGLE AUTH ROUTES ⭐
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/callback',
    passport.authenticate('google', { failureRedirect: '/login-failed' }),
    function(req, res) {
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

app.get('/login-failed', (req, res) => {
    res.send('Login failed. <a href="/auth/google">Try again</a>');
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// API Routes
app.get('/api/user/profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: req.user });
});

app.get('/api/menu', (req, res) => {
    res.json(menuItems);
});

app.get('/api/orders/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json(orders);
});

app.get('/api/orders/myorders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const userOrders = orders.filter(o => o.userId === req.user.id);
    res.json(userOrders);
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

// ⭐ SERVE HTML PAGES ⭐
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'admin.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🍔 DINEFLOW SERVER RUNNING');
    console.log('========================================');
    console.log(`📱 Customer: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
    console.log(`🔑 Callback: http://localhost:${PORT}/callback`);
    console.log('========================================');
    console.log('✅ Server is ready!');
    console.log('========================================');
});

module.exports = app;