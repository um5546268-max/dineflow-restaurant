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

// ============================================
// DATABASE
// ============================================
const users = [];
let orders = [];
let restaurantName = 'DineFlow';
let feedbacks = [];
let supportTickets = [];
let menuItems = [
    { id: 1, name: 'Cheese Burger', price: 1299, category: 'burgers', icons: ['🍔'], layers: ['🧀 Cheese', '🥬 Lettuce', '🍅 Tomato'] },
    { id: 2, name: 'Double Burger', price: 1599, category: 'burgers', icons: ['🍔', '🧀'], layers: ['🧀 Cheese', '🥬 Lettuce', '🍅 Tomato', '🥩 Extra Patty'] },
    { id: 3, name: 'Chicken Burger', price: 1199, category: 'burgers', icons: ['🍔', '🐔'], layers: ['🧀 Cheese', '🥬 Lettuce', '🌶️ Mayo'] },
    { id: 4, name: 'Margherita Pizza', price: 1499, category: 'pizza', icons: ['🍕', '🧀'] },
    { id: 5, name: 'Pepperoni Pizza', price: 1699, category: 'pizza', icons: ['🍕', '🥓'] },
    { id: 6, name: 'BBQ Chicken Pizza', price: 1799, category: 'pizza', icons: ['🍕', '🐔'] },
    { id: 7, name: 'Chicken Sandwich', price: 1099, category: 'sandwiches', icons: ['🥪', '🐔'] },
    { id: 8, name: 'Club Sandwich', price: 1199, category: 'sandwiches', icons: ['🥪', '🥓'] },
    { id: 9, name: 'French Fries', price: 499, category: 'sides', icons: ['🍟'] },
    { id: 10, name: 'Onion Rings', price: 599, category: 'sides', icons: ['🧅'] },
    { id: 11, name: 'Chocolate Shake', price: 599, category: 'drinks', icons: ['🥤', '🍫'] },
    { id: 12, name: 'Iced Tea', price: 399, category: 'drinks', icons: ['🧋'] },
    { id: 13, name: 'Caesar Salad', price: 899, category: 'salads', icons: ['🥗', '🧀'] },
    { id: 14, name: 'Greek Salad', price: 999, category: 'salads', icons: ['🥗'] },
    { id: 15, name: 'Chicken Wings', price: 999, category: 'appetizers', icons: ['🍗', '🔥'] },
    { id: 16, name: 'Mozzarella Sticks', price: 799, category: 'appetizers', icons: ['🧀', '🔥'] },
    { id: 17, name: 'Tiramisu', price: 699, category: 'desserts', icons: ['🍰', '☕'] },
    { id: 18, name: 'Chocolate Cake', price: 599, category: 'desserts', icons: ['🍫', '🎂'] }
];
let deals = [
    { id: 1, name: 'Burger Combo', desc: 'Cheese Burger + Fries + Drink', price: 1599, original: 2397, icons: ['🍔', '🍟', '🥤'] },
    { id: 2, name: 'Pizza Deal', desc: 'Large Pizza + 2 Drinks', price: 1899, original: 2897, icons: ['🍕', '🥤', '🥤'] },
    { id: 3, name: 'Family Pack', desc: '4 Sandwiches + 4 Fries', price: 2999, original: 4596, icons: ['🥪', '🥪', '🍟', '🍟'] },
    { id: 4, name: 'Wing Wednesday', desc: '12 Wings + Dip', price: 899, original: 1399, icons: ['🍗', '🔥', '🧀'] }
];
let availableLayers = [
    '🧀 Cheese', '🥬 Lettuce', '🍅 Tomato', '🧅 Onion',
    '🥩 Extra Patty', '🌶️ Mayo', '🧄 Garlic Sauce',
    '🌿 Jalapeno', '🍄 Mushroom', '🥓 Bacon'
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
// AUTH ROUTES
// ============================================
app.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        accessType: 'offline',
        prompt: 'select_account'
    })
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

// ============================================
// API ROUTES
// ============================================
app.get('/api/menu', (req, res) => { res.json(menuItems); });
app.get('/api/deals', (req, res) => { res.json(deals); });
app.get('/api/restaurant-name', (req, res) => { res.json({ name: restaurantName }); });
app.get('/api/layers', (req, res) => { res.json(availableLayers); });
app.get('/api/user/profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: req.user });
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
    const { items, total, name, phone, address, layers } = req.body;
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
        layers: layers || {},
        total: parseFloat(total),
        status: 'pending',
        date: new Date().toLocaleString(),
        createdAt: new Date()
    };
    orders.push(newOrder);
    res.status(201).json({ message: 'Order placed', order: newOrder });
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

app.post('/api/feedback', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const { rating, comment } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating is required' });
    const newFeedback = {
        id: feedbacks.length + 1,
        userId: req.user.id,
        userName: req.user.displayName,
        userEmail: req.user.email,
        rating: parseInt(rating),
        comment: comment || '',
        date: new Date().toLocaleString(),
        createdAt: new Date()
    };
    feedbacks.push(newFeedback);
    res.status(201).json({ success: true, feedback: newFeedback });
});

app.get('/api/feedback/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json(feedbacks);
});

app.delete('/api/feedback/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const index = feedbacks.findIndex(f => f.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Feedback not found' });
    feedbacks.splice(index, 1);
    res.json({ success: true });
});

app.post('/api/support', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const { subject, message, priority } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });
    const newTicket = {
        id: supportTickets.length + 1,
        userId: req.user.id,
        userName: req.user.displayName,
        userEmail: req.user.email,
        subject, message,
        priority: priority || 'normal',
        status: 'open',
        date: new Date().toLocaleString(),
        createdAt: new Date()
    };
    supportTickets.push(newTicket);
    res.status(201).json({ success: true, ticket: newTicket });
});

app.get('/api/support/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json(supportTickets);
});

app.put('/api/support/:id/status', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const ticket = supportTickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { status } = req.body;
    const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    ticket.status = status;
    res.json({ success: true, ticket });
});

app.post('/api/restaurant-name', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { name } = req.body;
    if (name) {
        restaurantName = name;
        res.json({ success: true, name: restaurantName });
    } else {
        res.status(400).json({ error: 'Name required' });
    }
});

app.post('/api/layers', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { layer } = req.body;
    if (!layer) return res.status(400).json({ error: 'Layer name is required' });
    if (!availableLayers.includes(layer)) {
        availableLayers.push(layer);
        res.json({ success: true, layers: availableLayers });
    } else {
        res.status(400).json({ error: 'Layer already exists' });
    }
});

app.delete('/api/layers/:layer', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const layer = decodeURIComponent(req.params.layer);
    const index = availableLayers.indexOf(layer);
    if (index === -1) return res.status(404).json({ error: 'Layer not found' });
    availableLayers.splice(index, 1);
    res.json({ success: true, layers: availableLayers });
});

app.put('/api/menu/:id/layers', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const item = menuItems.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { layers } = req.body;
    if (layers && Array.isArray(layers)) {
        item.layers = layers;
        res.json({ success: true, item });
    } else {
        res.status(400).json({ error: 'Invalid layers format' });
    }
});

app.post('/api/menu', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { name, price, category, icons, layers } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing required fields' });
    if (!icons || !icons.length) return res.status(400).json({ error: 'Please add at least one icon' });
    const newItem = {
        id: menuItems.length + 1,
        name,
        price: parseFloat(price),
        category,
        icons: icons.slice(0, 5),
        layers: layers || []
    };
    menuItems.push(newItem);
    res.status(201).json({ success: true, item: newItem });
});

app.delete('/api/menu/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const index = menuItems.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Item not found' });
    menuItems.splice(index, 1);
    res.json({ success: true });
});

app.post('/api/deals', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { name, desc, price, original, icons } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Missing required fields' });
    if (!icons || !icons.length) return res.status(400).json({ error: 'Please add at least one icon' });
    const newDeal = {
        id: deals.length + 1,
        name,
        desc: desc || '',
        price: parseFloat(price),
        original: parseFloat(original) || parseFloat(price) * 1.5,
        icons: icons.slice(0, 5)
    };
    deals.push(newDeal);
    res.status(201).json({ success: true, deal: newDeal });
});

app.delete('/api/deals/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const index = deals.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Deal not found' });
    deals.splice(index, 1);
    res.json({ success: true });
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
    console.log(`🍽️ Menu Items: ${menuItems.length}`);
    console.log(`🔥 Deals: ${deals.length}`);
    console.log(`📦 Orders: ${orders.length}`);
    console.log(`👤 Users: ${users.length}`);
    console.log('========================================');
    console.log('✅ Server is ready!');
    console.log('========================================');
});

module.exports = app;