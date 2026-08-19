// ============================================
// DEPENDENCIES
// ============================================
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
require('dotenv').config();

// ============================================
// DATABASE SETUP
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
    { id: 12, name: 'Iced Tea', price: 3.99, category: 'drinks', icon: '🧋' },
    { id: 13, name: 'Caesar Salad', price: 8.99, category: 'salads', icon: '🥗' },
    { id: 14, name: 'Greek Salad', price: 9.99, category: 'salads', icon: '🥗' },
    { id: 15, name: 'Chicken Wings', price: 9.99, category: 'appetizers', icon: '🍗' },
    { id: 16, name: 'Mozzarella Sticks', price: 7.99, category: 'appetizers', icon: '🧀' },
    { id: 17, name: 'Tiramisu', price: 6.99, category: 'desserts', icon: '🍰' },
    { id: 18, name: 'Chocolate Cake', price: 5.99, category: 'desserts', icon: '🍫' }
];

let deals = [
    { id: 1, name: '🍔 Burger Combo', desc: 'Cheese Burger + Fries + Drink', price: 15.99, original: 23.97 },
    { id: 2, name: '🍕 Pizza Deal', desc: 'Large Pizza + 2 Drinks', price: 18.99, original: 28.97 },
    { id: 3, name: '🥪 Family Pack', desc: '4 Sandwiches + 4 Fries', price: 29.99, original: 45.96 },
    { id: 4, name: '🍗 Wing Wednesday', desc: '12 Wings + Dip', price: 8.99, original: 13.99 }
];

let restaurantName = 'DineFlow';

// ============================================
// EXPRESS APP
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: ['http://localhost:5000', 'https://*.ngrok-free.dev', 'http://*.ngrok-free.dev', '*'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));

// ============================================
// NGROK WARNING SKIP
// ============================================
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// ============================================
// SESSION CONFIGURATION
// ============================================
const isProduction = process.env.NODE_ENV === 'production' || process.env.USE_HTTPS === 'true';

app.use(session({
    secret: process.env.SESSION_SECRET || 'dineflow-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// ============================================
// GOOGLE OAUTH STRATEGY
// ============================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/callback',
    passReqToCallback: true
  },
  function(request, accessToken, refreshToken, profile, done) {
    const existingUser = users.find(u => u.googleId === profile.id);
    
    if (existingUser) {
        existingUser.lastLogin = new Date();
        return done(null, existingUser);
    }
    
    const isAdmin = users.length === 0;
    
    const newUser = {
        id: users.length + 1,
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        photo: profile.photos[0].value,
        role: isAdmin ? 'admin' : 'customer',
        createdAt: new Date(),
        lastLogin: new Date(),
        orders: []
    };
    
    users.push(newUser);
    console.log(`✅ New user: ${newUser.displayName} (${newUser.role})`);
    return done(null, newUser);
  }
));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    const user = users.find(u => u.id === id);
    if (user) {
        done(null, user);
    } else {
        done(new Error('User not found'), null);
    }
});

// ============================================
// GOOGLE AUTH ROUTES
// ============================================

app.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

app.get('/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login-failed',
        failureMessage: true
    }),
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
    res.send(`
        <h1>❌ Login Failed</h1>
        <p>Please try again.</p>
        <a href="/auth/google">Try Again</a>
        <a href="/">Home</a>
    `);
});

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
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json({ user: req.user });
});

app.get('/api/users', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json({ total: users.length, users: users });
});

app.get('/api/menu', (req, res) => {
    res.json(menuItems);
});

app.get('/api/deals', (req, res) => {
    res.json(deals);
});

app.get('/api/restaurant-name', (req, res) => {
    res.json({ name: restaurantName });
});

app.post('/api/restaurant-name', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { name } = req.body;
    if (name) {
        restaurantName = name;
        res.json({ success: true, name: restaurantName });
    } else {
        res.status(400).json({ error: 'Name required' });
    }
});

app.post('/api/orders', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Please login first' });
    }
    
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
        date: new Date().toLocaleString(),
        createdAt: new Date()
    };
    
    orders.push(newOrder);
    res.status(201).json({ message: 'Order placed', order: newOrder });
});

app.get('/api/orders/myorders', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Please login first' });
    }
    const userOrders = orders.filter(o => o.userId === req.user.id);
    res.json(userOrders);
});

app.get('/api/orders/all', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json(orders);
});

app.put('/api/orders/:id/status', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    order.status = status;
    res.json({ success: true, order });
});

app.post('/api/menu', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { name, price, category, icon } = req.body;
    if (!name || !price || !category) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const newItem = {
        id: menuItems.length + 1,
        name,
        price: parseFloat(price),
        category,
        icon: icon || '🍽️'
    };
    menuItems.push(newItem);
    res.status(201).json({ success: true, item: newItem });
});

app.put('/api/menu/:id', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const item = menuItems.find(i => i.id === parseInt(req.params.id));
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    const { name, price, category, icon } = req.body;
    if (name) item.name = name;
    if (price) item.price = parseFloat(price);
    if (category) item.category = category;
    if (icon) item.icon = icon;
    res.json({ success: true, item });
});

app.delete('/api/menu/:id', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const index = menuItems.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }
    menuItems.splice(index, 1);
    res.json({ success: true });
});

app.post('/api/deals', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { name, desc, price, original } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const newDeal = {
        id: deals.length + 1,
        name,
        desc: desc || '',
        price: parseFloat(price),
        original: parseFloat(original) || parseFloat(price) * 1.5
    };
    deals.push(newDeal);
    res.status(201).json({ success: true, deal: newDeal });
});

app.delete('/api/deals/:id', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const index = deals.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) {
        return res.status(404).json({ error: 'Deal not found' });
    }
    deals.splice(index, 1);
    res.json({ success: true });
});

// ============================================
// SERVE PAGES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'admin.html'));
});

// ============================================
// GET LOCAL IP
// ============================================
function getLocalIp() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ error: 'Server Error' });
});

// ============================================
// START SERVER
// ============================================
const localIp = getLocalIp();

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🍔 DINEFLOW SERVER RUNNING');
    console.log('========================================');
    console.log(`📱 Customer: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
    console.log(`📱 Network: http://${localIp}:${PORT}`);
    console.log('========================================');
    console.log(`🔑 Google Auth: http://localhost:${PORT}/auth/google`);
    console.log('========================================');
    console.log('✅ Server is ready!');
    console.log(`📊 Users: ${users.length}`);
    console.log(`📦 Orders: ${orders.length}`);
    console.log('========================================');
});

module.exports = app;