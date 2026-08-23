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
// ⭐ WHATSAPP NUMBER CONFIGURATION ⭐
// ============================================
// CHANGE THIS TO YOUR WHATSAPP NUMBER
const WHATSAPP_NUMBER = '923001234567'; // Format: CountryCode + Number (e.g., 923001234567)
// ============================================

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
const restaurants = [];
let feedbacks = [];
let supportTickets = [];
let availableLayers = [
    '🧀 Cheese', '🥬 Lettuce', '🍅 Tomato', '🧅 Onion',
    '🥩 Extra Patty', '🌶️ Mayo', '🧄 Garlic Sauce',
    '🌿 Jalapeno', '🍄 Mushroom', '🥓 Bacon'
];
let customerLocations = [];

// ============================================
// DEFAULT MENU AND DEALS
// ============================================
function getDefaultMenu() {
    return [
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
}

function getDefaultDeals() {
    return [
        { id: 1, name: 'Burger Combo', desc: 'Cheese Burger + Fries + Drink', price: 1599, original: 2397, icons: ['🍔', '🍟', '🥤'] },
        { id: 2, name: 'Pizza Deal', desc: 'Large Pizza + 2 Drinks', price: 1899, original: 2897, icons: ['🍕', '🥤', '🥤'] },
        { id: 3, name: 'Family Pack', desc: '4 Sandwiches + 4 Fries', price: 2999, original: 4596, icons: ['🥪', '🥪', '🍟', '🍟'] },
        { id: 4, name: 'Wing Wednesday', desc: '12 Wings + Dip', price: 899, original: 1399, icons: ['🍗', '🔥', '🧀'] }
    ];
}

function createDefaultRestaurant() {
    if (restaurants.length === 0) {
        const defaultRestaurant = {
            id: 1,
            restaurantId: 'restaurant-1',
            name: 'DineFlow Restaurant',
            ownerName: 'Admin',
            ownerEmail: 'admin@dineflow.com',
            createdAt: new Date().toLocaleString(),
            menu: getDefaultMenu(),
            deals: getDefaultDeals(),
            orders: [],
            restaurantName: 'DineFlow Restaurant',
            status: 'active'
        };
        restaurants.push(defaultRestaurant);
        console.log('🏪 Default restaurant created');
    }
}

// ============================================
// RESTAURANT ID MIDDLEWARE
// ============================================
app.use((req, res, next) => {
    if (req.query.restaurant) {
        req.restaurantId = req.query.restaurant;
    } else if (req.session && req.session.restaurantId) {
        req.restaurantId = req.session.restaurantId;
    } else {
        req.restaurantId = 'restaurant-1';
    }
    if (req.session) {
        req.session.restaurantId = req.restaurantId;
    }
    next();
});

// ============================================
// RESTAURANT API
// ============================================
app.post('/api/restaurant/create', (req, res) => {
    const { name, ownerName, ownerEmail } = req.body;
    if (!name || !ownerName || !ownerEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = restaurants.find(r => r.ownerEmail === ownerEmail);
    if (existing) {
        return res.status(400).json({ error: 'Restaurant already exists with this email' });
    }
    const restaurantId = 'restaurant-' + (restaurants.length + 1);
    const newRestaurant = {
        id: restaurants.length + 1,
        restaurantId: restaurantId,
        name: name,
        ownerName: ownerName,
        ownerEmail: ownerEmail,
        createdAt: new Date().toLocaleString(),
        menu: getDefaultMenu(),
        deals: getDefaultDeals(),
        orders: [],
        restaurantName: name,
        status: 'active'
    };
    restaurants.push(newRestaurant);
    res.json({ success: true, restaurant: newRestaurant, restaurantId: restaurantId });
});

// ============================================
// ⭐ RESTAURANTS MANAGEMENT PANEL API ⭐
// ============================================

// Get all restaurants (for management panel)
app.get('/api/restaurants/all', (req, res) => {
    // If user is not logged in, return empty array
    if (!req.user) {
        return res.json([]);
    }
    res.json(restaurants);
});

// Save restaurants data (for management panel)
app.post('/api/restaurants/all', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { restaurants: newRestaurants } = req.body;
    if (newRestaurants && Array.isArray(newRestaurants)) {
        // This is for sync with localStorage
        res.json({ success: true, message: 'Restaurants data synced' });
    } else {
        res.status(400).json({ error: 'Invalid data' });
    }
});

// ============================================
// WHATSAPP NUMBER API
// ============================================
app.get('/api/whatsapp-number', (req, res) => {
    res.json({ number: WHATSAPP_NUMBER });
});

// ============================================
// MENU ROUTES
// ============================================
app.get('/api/menu', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    let restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        const id = parseInt(restaurantId.replace('restaurant-', ''));
        restaurant = restaurants.find(r => r.id === id);
    }
    if (!restaurant) {
        createDefaultRestaurant();
        restaurant = restaurants[0];
    }
    if (restaurant && restaurant.menu) {
        res.json(restaurant.menu);
    } else {
        res.json(getDefaultMenu());
    }
});

app.get('/api/deals', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    let restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        const id = parseInt(restaurantId.replace('restaurant-', ''));
        restaurant = restaurants.find(r => r.id === id);
    }
    if (!restaurant) {
        createDefaultRestaurant();
        restaurant = restaurants[0];
    }
    if (restaurant && restaurant.deals) {
        res.json(restaurant.deals);
    } else {
        res.json(getDefaultDeals());
    }
});

app.get('/api/restaurant-name', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    let restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        const id = parseInt(restaurantId.replace('restaurant-', ''));
        restaurant = restaurants.find(r => r.id === id);
    }
    if (!restaurant) {
        createDefaultRestaurant();
        restaurant = restaurants[0];
    }
    res.json({ name: restaurant ? restaurant.restaurantName : 'DineFlow' });
});

app.post('/api/restaurant-name', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const { name } = req.body;
    if (name) {
        restaurant.restaurantName = name;
        res.json({ success: true, name: restaurant.restaurantName });
    } else {
        res.status(400).json({ error: 'Name required' });
    }
});

app.post('/api/menu', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const { name, price, category, icons, layers } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing required fields' });
    if (!icons || !icons.length) return res.status(400).json({ error: 'Please add at least one icon' });
    const newItem = {
        id: restaurant.menu.length + 1,
        name,
        price: parseFloat(price),
        category,
        icons: icons.slice(0, 5),
        layers: layers || []
    };
    restaurant.menu.push(newItem);
    res.status(201).json({ success: true, item: newItem });
});

app.delete('/api/menu/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const index = restaurant.menu.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Item not found' });
    restaurant.menu.splice(index, 1);
    res.json({ success: true });
});

app.put('/api/menu/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const item = restaurant.menu.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { name, price, category, icon } = req.body;
    if (name) item.name = name;
    if (price) item.price = parseFloat(price);
    if (category) item.category = category;
    if (icon) item.icon = icon;
    res.json({ success: true, item });
});

app.put('/api/menu/:id/layers', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const item = restaurant.menu.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { layers } = req.body;
    if (layers && Array.isArray(layers)) {
        item.layers = layers;
        res.json({ success: true, item });
    } else {
        res.status(400).json({ error: 'Invalid layers format' });
    }
});

// ============================================
// DEAL ROUTES
// ============================================
app.post('/api/deals', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const { name, desc, price, original, icons } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Missing required fields' });
    if (!icons || !icons.length) return res.status(400).json({ error: 'Please add at least one icon' });
    const newDeal = {
        id: restaurant.deals.length + 1,
        name,
        desc: desc || '',
        price: parseFloat(price),
        original: parseFloat(original) || parseFloat(price) * 1.5,
        icons: icons.slice(0, 5)
    };
    restaurant.deals.push(newDeal);
    res.status(201).json({ success: true, deal: newDeal });
});

app.delete('/api/deals/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const index = restaurant.deals.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Deal not found' });
    restaurant.deals.splice(index, 1);
    res.json({ success: true });
});

// ============================================
// ORDER ROUTES
// ============================================
app.post('/api/orders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const { items, total, name, phone, address, layers, orderType, paymentMethod, lat, lng } = req.body;
    if (!items || !items.length || !total) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newOrder = {
        id: restaurant.orders.length + 1,
        userId: req.user.id,
        userName: name || req.user.displayName,
        phone: phone || '',
        address: address || 'In-store pickup',
        items: items,
        layers: layers || {},
        total: parseFloat(total),
        status: 'pending',
        orderType: orderType || 'delivery',
        paymentMethod: paymentMethod || 'cash',
        date: new Date().toLocaleString(),
        createdAt: new Date(),
        restaurantId: restaurantId,
        lat: orderType === 'delivery' ? (lat || null) : null,
        lng: orderType === 'delivery' ? (lng || null) : null,
        locationShared: orderType === 'delivery' && !!(lat && lng)
    };
    
    restaurant.orders.push(newOrder);
    
    // Save location for delivery orders
    if (orderType === 'delivery' && lat && lng) {
        customerLocations.push({
            id: customerLocations.length + 1,
            userId: req.user.id,
            userName: req.user.displayName,
            userEmail: req.user.email,
            restaurantId: restaurantId,
            orderId: newOrder.id,
            lat: lat,
            lng: lng,
            address: address || '',
            phone: phone || '',
            timestamp: new Date().toLocaleString(),
            updatedAt: new Date()
        });
    }
    
    console.log(`📦 New order #${newOrder.id} from ${newOrder.userName} (${orderType}) at ${restaurant.name}`);
    res.status(201).json({ message: 'Order placed', order: newOrder });
});

app.get('/api/orders/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant.orders);
});

app.get('/api/orders/myorders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
    }
    const userOrders = restaurant.orders.filter(o => o.userId === req.user.id);
    res.json(userOrders);
});

app.put('/api/orders/:id/status', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
    }
    const order = restaurant.orders.find(o => o.id === parseInt(req.params.id));
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
// LOCATION ROUTES
// ============================================
app.post('/api/location', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const { lat, lng, address, orderId } = req.body;
    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    const restaurantId = req.restaurantId || 'restaurant-1';
    const existing = customerLocations.find(l => l.userId === req.user.id && l.restaurantId === restaurantId);
    if (existing) {
        existing.lat = lat;
        existing.lng = lng;
        existing.address = address || '';
        existing.orderId = orderId || null;
        existing.updatedAt = new Date();
    } else {
        customerLocations.push({
            id: customerLocations.length + 1,
            userId: req.user.id,
            userName: req.user.displayName,
            userEmail: req.user.email,
            restaurantId: restaurantId,
            orderId: orderId || null,
            lat: lat,
            lng: lng,
            address: address || '',
            phone: req.user.phone || '',
            timestamp: new Date().toLocaleString(),
            updatedAt: new Date()
        });
    }
    res.json({ success: true, message: 'Location saved' });
});

app.get('/api/locations/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const locations = customerLocations.filter(l => l.restaurantId === restaurantId);
    res.json(locations);
});

app.delete('/api/location/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const index = customerLocations.findIndex(l => l.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Location not found' });
    customerLocations.splice(index, 1);
    res.json({ success: true });
});

// ============================================
// FEEDBACK ROUTES
// ============================================
app.post('/api/feedback', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const { rating, comment } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating is required' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const newFeedback = {
        id: feedbacks.length + 1,
        userId: req.user.id,
        userName: req.user.displayName,
        userEmail: req.user.email,
        rating: parseInt(rating),
        comment: comment || '',
        restaurantId: restaurantId,
        date: new Date().toLocaleString(),
        createdAt: new Date()
    };
    feedbacks.push(newFeedback);
    res.status(201).json({ success: true, feedback: newFeedback });
});

app.get('/api/feedback/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurantFeedbacks = feedbacks.filter(f => f.restaurantId === restaurantId);
    res.json(restaurantFeedbacks);
});

app.delete('/api/feedback/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const index = feedbacks.findIndex(f => f.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Feedback not found' });
    feedbacks.splice(index, 1);
    res.json({ success: true });
});

// ============================================
// SUPPORT ROUTES
// ============================================
app.post('/api/support', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const { subject, message, priority } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const newTicket = {
        id: supportTickets.length + 1,
        userId: req.user.id,
        userName: req.user.displayName,
        userEmail: req.user.email,
        subject, message,
        priority: priority || 'normal',
        status: 'open',
        restaurantId: restaurantId,
        date: new Date().toLocaleString(),
        createdAt: new Date()
    };
    supportTickets.push(newTicket);
    res.status(201).json({ success: true, ticket: newTicket });
});

app.get('/api/support/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurantTickets = supportTickets.filter(t => t.restaurantId === restaurantId);
    res.json(restaurantTickets);
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

// ============================================
// LAYERS ROUTES
// ============================================
app.get('/api/layers', (req, res) => {
    res.json(availableLayers);
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

// ============================================
// USER ROUTES
// ============================================
app.get('/api/user/profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: req.user });
});

app.get('/api/users', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ total: users.length, users: users });
});

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
            const restaurantId = req.session.restaurantId || 'restaurant-1';
            if (req.user && req.user.role === 'admin') {
                res.redirect('/admin?restaurant=' + restaurantId);
            } else {
                res.redirect('/?restaurant=' + restaurantId);
            }
        });
    }
);

app.get('/login-failed', (req, res) => {
    res.send('Login failed. <a href="/auth/google">Try again</a>');
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });
});

// ============================================
// ⭐ SERVE HTML PAGES ⭐
// ============================================

// Customer Panel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// Admin Panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'admin.html'));
});

// Restaurant Creation Page
app.get('/create-restaurant', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'create-restaurant.html'));
});

// ⭐ PixelPanel - Secret Restaurant Management Panel ⭐
app.get('/pixelpanel', (req, res) => {
    // Secret panel - only accessible to admin
    if (!req.user || req.user.role !== 'admin') {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>404 - Page Not Found</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0a0a0f; color: #e0e0e0; }
                    h1 { color: #e74c3c; font-size: 4em; }
                    .container { max-width: 500px; margin: 0 auto; }
                    .btn { display: inline-block; padding: 12px 30px; background: #e74c3c; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                    .btn:hover { background: #c0392b; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>404</h1>
                    <h2>Page Not Found</h2>
                    <p>The page you are looking for does not exist or has been moved.</p>
                    <a href="/" class="btn">Go Home</a>
                </div>
            </body>
            </html>
        `);
    }
    res.sendFile(path.join(__dirname, 'Public', 'pixelpanel.html'));
});

// ============================================
// START SERVER
// ============================================
createDefaultRestaurant();

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🍔 DINEFLOW SERVER RUNNING');
    console.log('========================================');
    console.log(`📱 Customer: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
    console.log(`🏪 Create Restaurant: http://localhost:${PORT}/create-restaurant`);
    console.log(`⬛ PixelPanel: http://localhost:${PORT}/pixelpanel`);
    console.log('========================================');
    console.log(`📱 WhatsApp Number: ${WHATSAPP_NUMBER}`);
    console.log('========================================');
    console.log(`🏪 Restaurants: ${restaurants.length}`);
    console.log(`👤 Users: ${users.length}`);
    console.log(`📦 Orders: ${restaurants.reduce((sum, r) => sum + r.orders.length, 0)}`);
    console.log('========================================');
    console.log('✅ Server is ready!');
    console.log('========================================');
});

module.exports = app;