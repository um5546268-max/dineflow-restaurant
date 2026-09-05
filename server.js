const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// ⭐ RESTAURANT CONFIGURATION ⭐
// ============================================
let RESTAURANT_CONFIG = {
    name: 'The Heaven Slice',
    est: '2022',
    address: 'Gojra Road Near Ali Marriage Hall',
    phone: '0300-0310275',
    whatsapp: '923001234567',
    currency: 'Rs',
    discountAmount: 330,
    discountThreshold: 2000,
    openingTime: '09:00',
    closingTime: '23:00',
    isOpen: true,
    cancellationTimeLimit: 5,
    allowCancellation: true
};

// ============================================
// ⭐ DATA PERSISTENCE ⭐
// ============================================
const DATA_FILE = path.join(__dirname, 'data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let data = {
    users: [],
    restaurants: [],
    feedbacks: [],
    supportTickets: [],
    availableLayers: [
        '🧀 Cheese', '🥬 Lettuce', '🍅 Tomato', '🧅 Onion',
        '🥩 Extra Patty', '🌶️ Mayo', '🧄 Garlic Sauce',
        '🌿 Jalapeno', '🍄 Mushroom', '🥓 Bacon'
    ],
    customerLocations: [],
    orderCounter: 1,
    receiptSettings: {
        logoIcon: '👨‍🍳',
        logoUrl: '',
        tagline: 'PIZZA • BURGER • FAST FOOD',
        established: RESTAURANT_CONFIG.est,
        address: RESTAURANT_CONFIG.address,
        phone: RESTAURANT_CONFIG.phone,
        qrCodeUrl: '',
        discountAmount: RESTAURANT_CONFIG.discountAmount,
        discountThreshold: RESTAURANT_CONFIG.discountThreshold,
        thankYouMessage: 'Thank You for Your Order!',
        footerMessage: 'Have a Great Day!',
        showCancellationTime: true
    },
    restaurantConfig: RESTAURANT_CONFIG,
    restaurantStatus: {
        isOpen: true,
        openingTime: '09:00',
        closingTime: '23:00',
        lastUpdated: new Date().toISOString()
    },
    aboutRestaurant: {
        description: 'Welcome to The Heaven Slice! We serve the best burgers, pizzas, and fast food in town. Our ingredients are always fresh and our service is top-notch. Visit us for an unforgettable dining experience!',
        photos: [],
        established: '2022',
        ownerName: 'Chef Ali',
        aboutTitle: 'About The Heaven Slice',
        workingHours: 'Mon-Sun: 9:00 AM - 11:00 PM'
    },
    lobbyDeals: [],
    deletedOrders: [],
    lastBackup: null,
    backupHistory: []
};

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            const loadedData = JSON.parse(fileContent);
            data = { ...data, ...loadedData };
            
            if (data.restaurantConfig) {
                RESTAURANT_CONFIG = data.restaurantConfig;
            }
            if (data.receiptSettings) {
                data.receiptSettings = { ...data.receiptSettings };
            }
            if (data.restaurantStatus) {
                RESTAURANT_CONFIG.isOpen = data.restaurantStatus.isOpen;
                RESTAURANT_CONFIG.openingTime = data.restaurantStatus.openingTime;
                RESTAURANT_CONFIG.closingTime = data.restaurantStatus.closingTime;
            }
            if (!data.aboutRestaurant) {
                data.aboutRestaurant = {
                    description: 'Welcome to The Heaven Slice! We serve the best burgers, pizzas, and fast food in town. Our ingredients are always fresh and our service is top-notch. Visit us for an unforgettable dining experience!',
                    photos: [],
                    established: '2022',
                    ownerName: 'Chef Ali',
                    aboutTitle: 'About The Heaven Slice',
                    workingHours: 'Mon-Sun: 9:00 AM - 11:00 PM'
                };
            }
            if (!data.lobbyDeals) {
                data.lobbyDeals = [];
            }
            if (!data.deletedOrders) {
                data.deletedOrders = [];
            }
            if (!data.backupHistory) {
                data.backupHistory = [];
            }
            
            console.log('✅ Data loaded from file');
            console.log(`📊 Discount: ${RESTAURANT_CONFIG.discountAmount} on ${RESTAURANT_CONFIG.discountThreshold}+`);
            console.log(`🕐 Restaurant: ${RESTAURANT_CONFIG.isOpen ? 'OPEN' : 'CLOSED'} (${RESTAURANT_CONFIG.openingTime} - ${RESTAURANT_CONFIG.closingTime})`);
            console.log(`🗑️ Deleted Orders: ${data.deletedOrders.length}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error loading data:', error);
        return false;
    }
}

function saveData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, DATA_FILE + '.backup');
        }
        data.restaurantConfig = RESTAURANT_CONFIG;
        data.receiptSettings = {
            ...data.receiptSettings,
            discountAmount: RESTAURANT_CONFIG.discountAmount,
            discountThreshold: RESTAURANT_CONFIG.discountThreshold,
            address: RESTAURANT_CONFIG.address,
            phone: RESTAURANT_CONFIG.phone,
            established: RESTAURANT_CONFIG.est
        };
        data.restaurantStatus = {
            isOpen: RESTAURANT_CONFIG.isOpen,
            openingTime: RESTAURANT_CONFIG.openingTime,
            closingTime: RESTAURANT_CONFIG.closingTime,
            lastUpdated: new Date().toISOString()
        };
        data.aboutRestaurant = aboutRestaurant;
        data.lobbyDeals = lobbyDeals;
        data.deletedOrders = deletedOrders;
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('💾 Data saved to file');
        return true;
    } catch (error) {
        console.error('❌ Error saving data:', error);
        return false;
    }
}

// ⭐ AUTO BACKUP FUNCTION
function createAutoBackup() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
        
        const backupData = JSON.parse(JSON.stringify(data));
        backupData.backupTimestamp = new Date().toISOString();
        backupData.backupType = 'auto';
        
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
        
        if (!data.backupHistory) data.backupHistory = [];
        data.backupHistory.push({
            timestamp: new Date().toISOString(),
            file: path.basename(backupFile),
            size: fs.statSync(backupFile).size,
            orderCount: data.restaurants.reduce((sum, r) => sum + r.orders.length, 0),
            deletedCount: deletedOrders.length
        });
        
        const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
        while (backups.length > 20) {
            const oldest = backups.shift();
            fs.unlinkSync(path.join(BACKUP_DIR, oldest));
        }
        
        data.lastBackup = new Date().toISOString();
        syncAndSave();
        console.log(`📦 Auto backup created: ${path.basename(backupFile)}`);
        return true;
    } catch (error) {
        console.error('❌ Auto backup failed:', error);
        return false;
    }
}

function scheduleAutoBackup() {
    const minInterval = 5 * 60 * 60 * 1000;
    const maxInterval = 10 * 60 * 60 * 1000;
    const interval = minInterval + Math.random() * (maxInterval - minInterval);
    
    setTimeout(() => {
        createAutoBackup();
        scheduleAutoBackup();
    }, interval);
}

setTimeout(() => {
    scheduleAutoBackup();
    console.log('⏰ Auto backup scheduler started (every 5-10 hours)');
}, 5000);

let saveCounter = 0;
const originalSyncAndSave = syncAndSave;
syncAndSave = function() {
    saveCounter++;
    const result = originalSyncAndSave();
    if (saveCounter % 50 === 0) {
        createAutoBackup();
    }
    return result;
};

setInterval(() => saveData(), 30000);

// ============================================
// ⭐ MIDDLEWARE ⭐
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({ 
    origin: true,
    credentials: true 
}));

app.use(express.static(path.join(__dirname, 'Public')));

// ============================================
// ⭐ SESSION ⭐
// ============================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'dineflow-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// ============================================
// ⭐ RESTAURANT ID MIDDLEWARE ⭐
// ============================================
app.use((req, res, next) => {
    let restaurantId = req.query.restaurant;
    if (!restaurantId && req.session && req.session.restaurantId) {
        restaurantId = req.session.restaurantId;
    }
    if (!restaurantId) {
        restaurantId = 'restaurant-1';
    }
    if (req.session) {
        req.session.restaurantId = restaurantId;
    }
    req.restaurantId = restaurantId;
    res.locals.restaurantId = restaurantId;
    next();
});

// ============================================
// ⭐ DATABASE REFERENCES ⭐
// ============================================
const users = data.users;
const restaurants = data.restaurants;
let feedbacks = data.feedbacks;
let supportTickets = data.supportTickets;
let availableLayers = data.availableLayers;
let customerLocations = data.customerLocations;
let orderCounter = data.orderCounter || 1;
let receiptSettings = data.receiptSettings;
let aboutRestaurant = data.aboutRestaurant || {
    description: 'Welcome to The Heaven Slice! We serve the best burgers, pizzas, and fast food in town. Our ingredients are always fresh and our service is top-notch. Visit us for an unforgettable dining experience!',
    photos: [],
    established: '2022',
    ownerName: 'Chef Ali',
    aboutTitle: 'About The Heaven Slice',
    workingHours: 'Mon-Sun: 9:00 AM - 11:00 PM'
};
let lobbyDeals = data.lobbyDeals || [];
let deletedOrders = data.deletedOrders || [];

function syncAndSave() {
    data.users = users;
    data.restaurants = restaurants;
    data.feedbacks = feedbacks;
    data.supportTickets = supportTickets;
    data.availableLayers = availableLayers;
    data.customerLocations = customerLocations;
    data.orderCounter = orderCounter;
    data.receiptSettings = receiptSettings;
    data.restaurantConfig = RESTAURANT_CONFIG;
    data.restaurantStatus = {
        isOpen: RESTAURANT_CONFIG.isOpen,
        openingTime: RESTAURANT_CONFIG.openingTime,
        closingTime: RESTAURANT_CONFIG.closingTime,
        lastUpdated: new Date().toISOString()
    };
    data.aboutRestaurant = aboutRestaurant;
    data.lobbyDeals = lobbyDeals;
    data.deletedOrders = deletedOrders;
    saveData();
}

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

// ============================================
// ⭐ CREATE OR GET RESTAURANT ⭐
// ============================================
function getOrCreateRestaurant(restaurantId) {
    let restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    if (!restaurant) {
        const numId = parseInt(restaurantId.replace('restaurant-', ''));
        if (!isNaN(numId)) {
            restaurant = restaurants.find(r => r.id === numId);
        }
    }
    if (!restaurant) {
        const numId = restaurants.length + 1;
        restaurant = {
            id: numId,
            restaurantId: restaurantId,
            name: RESTAURANT_CONFIG.name + (numId > 1 ? ` (${numId})` : ''),
            ownerName: 'Admin',
            ownerEmail: `admin@${restaurantId}.com`,
            createdAt: new Date().toLocaleString(),
            menu: getDefaultMenu(),
            deals: getDefaultDeals(),
            orders: [],
            restaurantName: RESTAURANT_CONFIG.name + (numId > 1 ? ` (${numId})` : ''),
            status: 'active'
        };
        restaurants.push(restaurant);
        syncAndSave();
        console.log(`🏪 Created new restaurant: ${restaurantId}`);
    }
    return restaurant;
}

function createDefaultRestaurant() {
    if (restaurants.length === 0) {
        const defaultRestaurant = {
            id: 1,
            restaurantId: 'restaurant-1',
            name: RESTAURANT_CONFIG.name,
            ownerName: 'Admin',
            ownerEmail: 'admin@dineflow.com',
            createdAt: new Date().toLocaleString(),
            menu: getDefaultMenu(),
            deals: getDefaultDeals(),
            orders: [],
            restaurantName: RESTAURANT_CONFIG.name,
            status: 'active'
        };
        restaurants.push(defaultRestaurant);
        syncAndSave();
        console.log('🏪 Default restaurant created');
    }
}

// ============================================
// ⭐ SSE + LONG POLLING FOR REAL-TIME ORDERS ⭐
// ============================================
const adminClients = new Set();
let clientIdCounter = 0;
let orderUpdateBuffer = [];
const MAX_BUFFER_SIZE = 100;

app.get('/api/orders/stream', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const clientId = ++clientIdCounter;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
    });
    
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId: clientId })}\n\n`);
    
    const restaurant = getOrCreateRestaurant(restaurantId);
    const recentOrders = restaurant.orders.slice(-5);
    if (recentOrders.length > 0) {
        recentOrders.forEach(order => {
            res.write(`data: ${JSON.stringify({ type: 'new_order', order: order, catchup: true })}\n\n`);
        });
    }
    
    const client = { 
        id: clientId, 
        res: res, 
        restaurantId: restaurantId, 
        lastPing: Date.now(),
        connected: true
    };
    adminClients.add(client);
    
    console.log(`✅ Admin client ${clientId} connected (Total: ${adminClients.size})`);
    
    const pingInterval = setInterval(() => {
        try {
            if (client.connected) {
                client.lastPing = Date.now();
                res.write(`: ping\n\n`);
            }
        } catch (e) {
            clearInterval(pingInterval);
            adminClients.delete(client);
            console.log(`❌ Admin client ${clientId} disconnected (ping failed)`);
        }
    }, 10000);
    
    req.on('close', () => {
        client.connected = false;
        clearInterval(pingInterval);
        adminClients.delete(client);
        console.log(`❌ Admin client ${clientId} disconnected (Total: ${adminClients.size})`);
    });
    
    req.setTimeout(120000, () => {
        client.connected = false;
        clearInterval(pingInterval);
        adminClients.delete(client);
        res.end();
        console.log(`⏰ Admin client ${clientId} timed out`);
    });
});

app.get('/api/orders/poll', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const lastOrderId = parseInt(req.query.lastId) || 0;
    const timeout = parseInt(req.query.timeout) || 30000;
    
    const newOrders = restaurant.orders.filter(o => o.id > lastOrderId);
    
    if (newOrders.length > 0) {
        return res.json({ orders: newOrders, lastId: restaurant.orders.length });
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
        const currentOrders = getOrCreateRestaurant(restaurantId);
        const freshOrders = currentOrders.orders.filter(o => o.id > lastOrderId);
        
        if (freshOrders.length > 0) {
            clearInterval(checkInterval);
            res.json({ orders: freshOrders, lastId: currentOrders.orders.length });
        } else if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            res.json({ orders: [], lastId: lastOrderId });
        }
    }, 1000);
    
    req.on('close', () => {
        clearInterval(checkInterval);
    });
});

function broadcastNewOrder(order, restaurantId) {
    const message = JSON.stringify({
        type: 'new_order',
        order: order,
        timestamp: new Date().toISOString()
    });
    
    const data = `data: ${message}\n\n`;
    let sentCount = 0;
    
    adminClients.forEach(client => {
        if (client.connected && (client.restaurantId === restaurantId || !client.restaurantId)) {
            try {
                client.res.write(data);
                sentCount++;
            } catch (e) {
                client.connected = false;
                adminClients.delete(client);
            }
        }
    });
    
    console.log(`📡 Broadcasted order #${order.id} to ${sentCount} admin clients (Total: ${adminClients.size})`);
    
    orderUpdateBuffer.push({ order, restaurantId, timestamp: Date.now() });
    if (orderUpdateBuffer.length > MAX_BUFFER_SIZE) {
        orderUpdateBuffer.shift();
    }
}

function broadcastOrderUpdate(order, restaurantId) {
    const message = JSON.stringify({
        type: 'order_update',
        order: order,
        timestamp: new Date().toISOString()
    });
    
    const data = `data: ${message}\n\n`;
    
    adminClients.forEach(client => {
        if (client.connected && (client.restaurantId === restaurantId || !client.restaurantId)) {
            try {
                client.res.write(data);
            } catch (e) {
                client.connected = false;
                adminClients.delete(client);
            }
        }
    });
}

// ============================================
// ⭐ BACKUP & RECOVERY ROUTES ⭐
// ============================================

app.get('/api/backup/status', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
        const backupInfo = backups.map(file => {
            const stats = fs.statSync(path.join(BACKUP_DIR, file));
            return {
                file: file,
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString()
            };
        });
        
        res.json({
            lastBackup: data.lastBackup || null,
            backupCount: backupInfo.length,
            backups: backupInfo.slice(0, 20),
            deletedOrdersCount: deletedOrders.length,
            autoBackupEnabled: true
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get backup status' });
    }
});

app.post('/api/backup/create', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const result = createAutoBackup();
        if (result) {
            res.json({ success: true, message: 'Backup created successfully', lastBackup: data.lastBackup });
        } else {
            res.status(500).json({ error: 'Failed to create backup' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

app.post('/api/backup/restore', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ error: 'Filename required' });
        }
        
        const backupFile = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }
        
        const backupContent = fs.readFileSync(backupFile, 'utf8');
        const backupData = JSON.parse(backupContent);
        
        if (!backupData.restaurants) {
            return res.status(400).json({ error: 'Invalid backup file' });
        }
        
        restaurants.length = 0;
        restaurants.push(...backupData.restaurants);
        
        if (backupData.deletedOrders) {
            deletedOrders.length = 0;
            deletedOrders.push(...backupData.deletedOrders);
        }
        
        if (backupData.aboutRestaurant) {
            aboutRestaurant = backupData.aboutRestaurant;
        }
        
        if (backupData.lobbyDeals) {
            lobbyDeals = backupData.lobbyDeals;
        }
        
        if (backupData.receiptSettings) {
            receiptSettings = backupData.receiptSettings;
        }
        
        if (backupData.restaurantConfig) {
            RESTAURANT_CONFIG = backupData.restaurantConfig;
        }
        
        if (backupData.feedbacks) {
            feedbacks = backupData.feedbacks;
        }
        
        if (backupData.supportTickets) {
            supportTickets = backupData.supportTickets;
        }
        
        if (backupData.customerLocations) {
            customerLocations = backupData.customerLocations;
        }
        
        if (backupData.availableLayers) {
            availableLayers = backupData.availableLayers;
        }
        
        if (backupData.orderCounter) {
            orderCounter = backupData.orderCounter;
        }
        
        syncAndSave();
        
        res.json({ 
            success: true, 
            message: 'Restaurant restored from backup successfully!',
            ordersRestored: restaurants.reduce((sum, r) => sum + r.orders.length, 0),
            deletedRestored: deletedOrders.length
        });
    } catch (error) {
        console.error('Restore error:', error);
        res.status(500).json({ error: 'Failed to restore from backup: ' + error.message });
    }
});

app.get('/api/backup/deleted-orders', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        res.json(deletedOrders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get deleted orders' });
    }
});

app.post('/api/backup/recover-order/:id', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const orderId = parseInt(req.params.id);
        const index = deletedOrders.findIndex(o => o.id === orderId);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Deleted order not found' });
        }
        
        const recoveredOrder = deletedOrders[index];
        deletedOrders.splice(index, 1);
        
        const restaurant = restaurants.find(r => r.restaurantId === recoveredOrder.restaurantId);
        if (restaurant) {
            recoveredOrder.recoveredAt = new Date().toISOString();
            recoveredOrder.status = 'pending';
            restaurant.orders.push(recoveredOrder);
        } else {
            const defaultRestaurant = getOrCreateRestaurant('restaurant-1');
            recoveredOrder.recoveredAt = new Date().toISOString();
            recoveredOrder.status = 'pending';
            defaultRestaurant.orders.push(recoveredOrder);
        }
        
        syncAndSave();
        
        res.json({ 
            success: true, 
            message: 'Order #' + orderId + ' recovered successfully!',
            order: recoveredOrder
        });
    } catch (error) {
        console.error('Recover order error:', error);
        res.status(500).json({ error: 'Failed to recover order' });
    }
});

app.delete('/api/backup/deleted-order/:id', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const orderId = parseInt(req.params.id);
        const index = deletedOrders.findIndex(o => o.id === orderId);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Deleted order not found' });
        }
        
        deletedOrders.splice(index, 1);
        syncAndSave();
        
        res.json({ 
            success: true, 
            message: 'Order #' + orderId + ' permanently deleted!'
        });
    } catch (error) {
        console.error('Delete deleted order error:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

// ============================================
// ⭐ API ROUTES ⭐
// ============================================

app.get('/api/check-restaurant', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    res.json({ 
        exists: true, 
        restaurant: {
            id: restaurant.id,
            restaurantId: restaurant.restaurantId,
            name: restaurant.restaurantName
        }
    });
});

app.get('/api/restaurant-config', (req, res) => {
    res.json(RESTAURANT_CONFIG);
});

app.post('/api/restaurant-config-update', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    try {
        const { discountAmount, discountThreshold, currency, address, phone, est, whatsapp } = req.body;
        
        if (discountAmount !== undefined && !isNaN(discountAmount)) {
            RESTAURANT_CONFIG.discountAmount = Number(discountAmount);
        }
        if (discountThreshold !== undefined && !isNaN(discountThreshold)) {
            RESTAURANT_CONFIG.discountThreshold = Number(discountThreshold);
        }
        if (currency) RESTAURANT_CONFIG.currency = currency;
        if (address) RESTAURANT_CONFIG.address = address;
        if (phone) RESTAURANT_CONFIG.phone = phone;
        if (est) RESTAURANT_CONFIG.est = est;
        if (whatsapp) RESTAURANT_CONFIG.whatsapp = whatsapp;
        
        if (discountAmount !== undefined) receiptSettings.discountAmount = Number(discountAmount);
        if (discountThreshold !== undefined) receiptSettings.discountThreshold = Number(discountThreshold);
        if (address) receiptSettings.address = address;
        if (phone) receiptSettings.phone = phone;
        if (est) receiptSettings.established = est;
        
        syncAndSave();
        
        res.json({ 
            success: true, 
            message: 'Restaurant config updated successfully',
            config: RESTAURANT_CONFIG
        });
    } catch (error) {
        console.error('Error updating restaurant config:', error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

app.get('/api/whatsapp-number', (req, res) => {
    res.json({ number: RESTAURANT_CONFIG.whatsapp });
});

app.get('/api/receipt-settings', (req, res) => {
    try {
        res.json(receiptSettings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

app.post('/api/receipt-settings', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const allowedFields = [
            'logoIcon', 'logoUrl', 'tagline', 'established', 'address', 'phone',
            'qrCodeUrl', 'discountAmount', 'discountThreshold',
            'thankYouMessage', 'footerMessage', 'showCancellationTime'
        ];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined && req.body[field] !== null) {
                receiptSettings[field] = req.body[field];
                if (field === 'discountAmount') {
                    RESTAURANT_CONFIG.discountAmount = Number(req.body[field]);
                }
                if (field === 'discountThreshold') {
                    RESTAURANT_CONFIG.discountThreshold = Number(req.body[field]);
                }
                if (field === 'address') {
                    RESTAURANT_CONFIG.address = req.body[field];
                }
                if (field === 'phone') {
                    RESTAURANT_CONFIG.phone = req.body[field];
                }
                if (field === 'established') {
                    RESTAURANT_CONFIG.est = req.body[field];
                }
            }
        });
        if (!receiptSettings.logoIcon) {
            receiptSettings.logoIcon = '👨‍🍳';
        }
        syncAndSave();
        res.json({ success: true, settings: receiptSettings, config: RESTAURANT_CONFIG });
    } catch (error) {
        console.error('Error saving receipt settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// ============================================
// ⭐ ABOUT RESTAURANT ROUTES ⭐
// ============================================
app.get('/api/about-restaurant', (req, res) => {
    try {
        res.json(aboutRestaurant);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get about data' });
    }
});

app.post('/api/about-restaurant', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const { description, photos, established, ownerName, aboutTitle, workingHours } = req.body;
        
        if (description !== undefined) aboutRestaurant.description = description;
        if (photos !== undefined) aboutRestaurant.photos = photos;
        if (established !== undefined) aboutRestaurant.established = established;
        if (ownerName !== undefined) aboutRestaurant.ownerName = ownerName;
        if (aboutTitle !== undefined) aboutRestaurant.aboutTitle = aboutTitle;
        if (workingHours !== undefined) aboutRestaurant.workingHours = workingHours;
        
        syncAndSave();
        res.json({ success: true, about: aboutRestaurant });
    } catch (error) {
        console.error('Error saving about data:', error);
        res.status(500).json({ error: 'Failed to save about data' });
    }
});

// ============================================
// ⭐ LOBBY DEALS ROUTES ⭐
// ============================================

app.get('/api/lobby-deals', (req, res) => {
    try {
        res.json(lobbyDeals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get lobby deals' });
    }
});

app.get('/api/lobby-deals/active', (req, res) => {
    try {
        const now = new Date();
        const activeDeals = lobbyDeals.filter(d => {
            if (d.isActive === false) return false;
            if (d.expiryDate) {
                const expiry = new Date(d.expiryDate);
                return expiry > now;
            }
            return true;
        });
        res.json(activeDeals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get active deals' });
    }
});

app.post('/api/lobby-deals', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const { title, description, price, originalPrice, image, discount, isActive, expiryDays } = req.body;
        
        if (!title || !price) {
            return res.status(400).json({ error: 'Title and price are required' });
        }
        
        let expiryDate = null;
        if (expiryDays && parseInt(expiryDays) > 0) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
            expiryDate = expiryDate.toISOString();
        }
        
        const newDeal = {
            id: lobbyDeals.length + 1,
            title: title,
            description: description || '',
            price: parseFloat(price),
            originalPrice: parseFloat(originalPrice) || parseFloat(price) * 1.5,
            image: image || '',
            discount: discount || 0,
            isActive: isActive !== undefined ? isActive : true,
            expiryDate: expiryDate,
            expiryDays: expiryDays || null,
            createdAt: new Date().toISOString()
        };
        
        lobbyDeals.push(newDeal);
        syncAndSave();
        res.status(201).json({ success: true, deal: newDeal });
    } catch (error) {
        console.error('Error adding lobby deal:', error);
        res.status(500).json({ error: 'Failed to add deal' });
    }
});

app.put('/api/lobby-deals/:id', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const dealId = parseInt(req.params.id);
        const deal = lobbyDeals.find(d => d.id === dealId);
        
        if (!deal) {
            return res.status(404).json({ error: 'Deal not found' });
        }
        
        const { title, description, price, originalPrice, image, discount, isActive, expiryDays } = req.body;
        
        if (title !== undefined) deal.title = title;
        if (description !== undefined) deal.description = description;
        if (price !== undefined) deal.price = parseFloat(price);
        if (originalPrice !== undefined) deal.originalPrice = parseFloat(originalPrice);
        if (image !== undefined) deal.image = image;
        if (discount !== undefined) deal.discount = parseFloat(discount);
        if (isActive !== undefined) deal.isActive = isActive;
        
        if (expiryDays !== undefined) {
            deal.expiryDays = expiryDays;
            if (expiryDays && parseInt(expiryDays) > 0) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
                deal.expiryDate = expiryDate.toISOString();
            } else {
                deal.expiryDate = null;
            }
        }
        
        syncAndSave();
        res.json({ success: true, deal: deal });
    } catch (error) {
        console.error('Error updating lobby deal:', error);
        res.status(500).json({ error: 'Failed to update deal' });
    }
});

app.delete('/api/lobby-deals/:id', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const dealId = parseInt(req.params.id);
        const index = lobbyDeals.findIndex(d => d.id === dealId);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Deal not found' });
        }
        
        lobbyDeals.splice(index, 1);
        syncAndSave();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting lobby deal:', error);
        res.status(500).json({ error: 'Failed to delete deal' });
    }
});

app.delete('/api/lobby-deals/all', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        lobbyDeals = [];
        syncAndSave();
        res.json({ success: true, message: 'All lobby deals deleted' });
    } catch (error) {
        console.error('Error deleting all lobby deals:', error);
        res.status(500).json({ error: 'Failed to delete all deals' });
    }
});

// ============================================
// ⭐ RESTAURANT STATUS ROUTES (Open/Close) ⭐
// ============================================
app.get('/api/restaurant-status', (req, res) => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const opening = RESTAURANT_CONFIG.openingTime || '09:00';
    const closing = RESTAURANT_CONFIG.closingTime || '23:00';
    const isWithinHours = currentTime >= opening && currentTime <= closing;
    
    const isOpen = RESTAURANT_CONFIG.isOpen !== undefined ? RESTAURANT_CONFIG.isOpen : isWithinHours;
    
    res.json({
        isOpen: isOpen,
        openingTime: opening,
        closingTime: closing,
        currentTime: currentTime,
        message: isOpen ? 'Restaurant is open' : 'Restaurant is closed',
        autoMode: RESTAURANT_CONFIG.isOpen === undefined
    });
});

app.post('/api/restaurant-status', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    try {
        const { isOpen, openingTime, closingTime } = req.body;
        
        if (isOpen !== undefined) {
            RESTAURANT_CONFIG.isOpen = isOpen;
        }
        if (openingTime) {
            RESTAURANT_CONFIG.openingTime = openingTime;
        }
        if (closingTime) {
            RESTAURANT_CONFIG.closingTime = closingTime;
        }
        
        syncAndSave();
        
        res.json({
            success: true,
            message: 'Restaurant status updated',
            status: {
                isOpen: RESTAURANT_CONFIG.isOpen,
                openingTime: RESTAURANT_CONFIG.openingTime,
                closingTime: RESTAURANT_CONFIG.closingTime
            }
        });
    } catch (error) {
        console.error('Error updating restaurant status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ============================================
// ⭐ ORDER CANCELLATION ROUTES ⭐
// ============================================
app.post('/api/orders/:id/cancel', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const order = restaurant.orders.find(o => o.id === parseInt(req.params.id));
    
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    if (req.body.isCustomer && order.userId !== req.user.id) {
        return res.status(403).json({ error: 'You can only cancel your own orders' });
    }
    
    if (req.body.isCustomer && !RESTAURANT_CONFIG.allowCancellation) {
        return res.status(400).json({ error: 'Order cancellation is disabled by restaurant' });
    }
    
    if (req.body.isCustomer && RESTAURANT_CONFIG.cancellationTimeLimit > 0) {
        const orderTime = new Date(order.createdAt || order.date);
        const now = new Date();
        const minutesDiff = (now - orderTime) / (1000 * 60);
        
        if (minutesDiff > RESTAURANT_CONFIG.cancellationTimeLimit) {
            return res.status(400).json({ 
                error: `Cancellation time limit exceeded. You can only cancel within ${RESTAURANT_CONFIG.cancellationTimeLimit} minutes.`,
                timeLimit: RESTAURANT_CONFIG.cancellationTimeLimit
            });
        }
    }
    
    if (order.status === 'delivered' || order.status === 'cancelled') {
        return res.status(400).json({ error: 'Order cannot be cancelled' });
    }
    
    order.status = 'cancelled';
    syncAndSave();
    
    broadcastOrderUpdate(order, restaurantId);
    
    res.json({ success: true, message: 'Order cancelled successfully', order: order });
});

app.delete('/api/orders/:id', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const index = restaurant.orders.findIndex(o => o.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    const deletedOrder = restaurant.orders[index];
    restaurant.orders.splice(index, 1);
    
    deletedOrder.deletedAt = new Date().toISOString();
    deletedOrder.deletedBy = req.user.displayName || 'Admin';
    deletedOrder.restaurantId = restaurantId;
    deletedOrders.push(deletedOrder);
    
    syncAndSave();
    
    broadcastOrderUpdate({ ...deletedOrder, status: 'deleted' }, restaurantId);
    
    res.json({ 
        success: true, 
        message: 'Order deleted and backed up',
        orderId: deletedOrder.id
    });
});

app.delete('/api/orders/today/all', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    
    const today = new Date().toDateString();
    const ordersToDelete = restaurant.orders.filter(o => {
        const orderDate = new Date(o.createdAt || o.date);
        return orderDate.toDateString() === today;
    });
    
    if (ordersToDelete.length === 0) {
        return res.json({ 
            success: true, 
            message: 'No orders found for today',
            deletedCount: 0
        });
    }
    
    ordersToDelete.forEach(order => {
        order.deletedAt = new Date().toISOString();
        order.deletedBy = req.user.displayName || 'Admin';
        order.restaurantId = restaurantId;
        deletedOrders.push(order);
    });
    
    restaurant.orders = restaurant.orders.filter(o => {
        const orderDate = new Date(o.createdAt || o.date);
        return orderDate.toDateString() !== today;
    });
    
    syncAndSave();
    
    res.json({ 
        success: true, 
        message: ordersToDelete.length + ' orders deleted and backed up',
        deletedCount: ordersToDelete.length
    });
});

app.get('/api/orders/today', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    
    const today = new Date().toDateString();
    const todayOrders = restaurant.orders.filter(o => {
        const orderDate = new Date(o.createdAt || o.date);
        return orderDate.toDateString() === today;
    });
    
    res.json({
        date: new Date().toISOString(),
        totalOrders: todayOrders.length,
        orders: todayOrders,
        totalRevenue: todayOrders.reduce((sum, o) => sum + o.total, 0)
    });
});

// ============================================
// ⭐ ORDER CANCELLATION SETTINGS ⭐
// ============================================
app.get('/api/cancellation-settings', (req, res) => {
    res.json({
        allowCancellation: RESTAURANT_CONFIG.allowCancellation,
        cancellationTimeLimit: RESTAURANT_CONFIG.cancellationTimeLimit
    });
});

app.post('/api/cancellation-settings', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    try {
        const { allowCancellation, cancellationTimeLimit } = req.body;
        
        if (allowCancellation !== undefined) {
            RESTAURANT_CONFIG.allowCancellation = allowCancellation;
        }
        if (cancellationTimeLimit !== undefined && !isNaN(cancellationTimeLimit)) {
            RESTAURANT_CONFIG.cancellationTimeLimit = Number(cancellationTimeLimit);
        }
        
        syncAndSave();
        
        res.json({
            success: true,
            message: 'Cancellation settings updated',
            settings: {
                allowCancellation: RESTAURANT_CONFIG.allowCancellation,
                cancellationTimeLimit: RESTAURANT_CONFIG.cancellationTimeLimit
            }
        });
    } catch (error) {
        console.error('Error updating cancellation settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

app.get('/api/location/reverse', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Missing lat/lng' });
        }
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'TheHeavenSlice-App/2.0',
                'Accept': 'application/json',
                'Accept-Language': 'en'
            }
        });
        if (!response.ok) throw new Error('OpenStreetMap API error');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        res.status(500).json({ error: 'Failed to get address' });
    }
});

app.get('/api/map/embed', (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
        return res.status(400).json({ error: 'Missing lat/lng' });
    }
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01}%2C${lat-0.01}%2C${lng+0.01}%2C${lat+0.01}&layer=mapnik&marker=${lat}%2C${lng}`;
    res.json({ url: mapUrl });
});

// ============================================
// RESTAURANT MANAGEMENT API
// ============================================
app.get('/api/restaurants/all', (req, res) => {
    if (!req.user) return res.json([]);
    res.json(restaurants);
});

app.get('/api/restaurants/summary', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const summary = restaurants.map(r => ({
        id: r.id,
        restaurantId: r.restaurantId,
        name: r.name,
        ownerName: r.ownerName,
        ownerEmail: r.ownerEmail,
        createdAt: r.createdAt,
        status: r.status,
        orderCount: r.orders.length,
        menuCount: r.menu.length,
        dealsCount: r.deals.length
    }));
    res.json(summary);
});

app.get('/api/restaurants/:id', (req, res) => {
    const restaurant = restaurants.find(r => r.restaurantId === req.params.id || r.id === parseInt(req.params.id));
    if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
});

// ============================================
// MENU ROUTES
// ============================================
app.get('/api/menu', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    res.json(restaurant.menu || getDefaultMenu());
});

app.get('/api/deals', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    res.json(restaurant.deals || getDefaultDeals());
});

app.get('/api/restaurant-name', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    res.json({ name: restaurant.restaurantName || RESTAURANT_CONFIG.name });
});

app.post('/api/restaurant-name', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const { name } = req.body;
    if (name) {
        restaurant.restaurantName = name;
        restaurant.name = name;
        RESTAURANT_CONFIG.name = name;
        syncAndSave();
        res.json({ success: true, name: restaurant.restaurantName });
    } else {
        res.status(400).json({ error: 'Name required' });
    }
});

app.post('/api/menu', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
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
    syncAndSave();
    res.status(201).json({ success: true, item: newItem });
});

app.delete('/api/menu/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const index = restaurant.menu.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Item not found' });
    restaurant.menu.splice(index, 1);
    syncAndSave();
    res.json({ success: true });
});

app.put('/api/menu/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const item = restaurant.menu.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { name, price, category, icons, layers } = req.body;
    if (name) item.name = name;
    if (price) item.price = parseFloat(price);
    if (category) item.category = category;
    if (icons && icons.length) item.icons = icons.slice(0, 5);
    if (layers !== undefined) item.layers = layers;
    syncAndSave();
    res.json({ success: true, item });
});

app.put('/api/menu/:id/layers', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const item = restaurant.menu.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { layers } = req.body;
    if (layers && Array.isArray(layers)) {
        item.layers = layers;
        syncAndSave();
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
    const restaurant = getOrCreateRestaurant(restaurantId);
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
    syncAndSave();
    res.status(201).json({ success: true, deal: newDeal });
});

app.delete('/api/deals/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const index = restaurant.deals.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Deal not found' });
    restaurant.deals.splice(index, 1);
    syncAndSave();
    res.json({ success: true });
});

// ============================================
// ⭐ ORDER ROUTES WITH BROADCAST ⭐
// ============================================
app.post('/api/orders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const opening = RESTAURANT_CONFIG.openingTime || '09:00';
    const closing = RESTAURANT_CONFIG.closingTime || '23:00';
    const isWithinHours = currentTime >= opening && currentTime <= closing;
    const isOpen = RESTAURANT_CONFIG.isOpen !== undefined ? RESTAURANT_CONFIG.isOpen : isWithinHours;
    
    if (!isOpen) {
        return res.status(403).json({ 
            error: 'restaurant_closed',
            message: `Restaurant is currently closed. Opens at ${opening} and closes at ${closing}`,
            openingTime: opening,
            closingTime: closing
        });
    }
    
    const { items, total, name, phone, address, layers, orderType, paymentMethod, lat, lng, table, deviceTime, deviceTimestamp } = req.body;
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
        layers: layers || [],
        total: parseFloat(total),
        status: 'pending',
        orderType: orderType || 'delivery',
        paymentMethod: paymentMethod || 'cash',
        date: new Date().toLocaleString(),
        createdAt: new Date(),
        restaurantId: restaurantId,
        lat: orderType === 'delivery' ? (lat || null) : null,
        lng: orderType === 'delivery' ? (lng || null) : null,
        locationShared: orderType === 'delivery' && !!(lat && lng),
        table: table || null,
        orderNumber: orderCounter++,
        deviceTime: deviceTime || new Date().toLocaleString(),
        deviceTimestamp: deviceTimestamp || new Date().toISOString(),
        cancellationDeadline: new Date(Date.now() + (RESTAURANT_CONFIG.cancellationTimeLimit || 5) * 60000).toISOString()
    };
    
    restaurant.orders.push(newOrder);
    syncAndSave();
    
    broadcastNewOrder(newOrder, restaurantId);
    
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
        syncAndSave();
    }
    
    res.status(201).json({ message: 'Order placed', order: newOrder });
});

app.get('/api/orders/all', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    res.json(restaurant.orders);
});

app.get('/api/orders/myorders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const userOrders = restaurant.orders.filter(o => o.userId === req.user.id);
    res.json(userOrders);
});

app.put('/api/orders/:id/status', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const order = restaurant.orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    order.status = status;
    syncAndSave();
    
    broadcastOrderUpdate(order, restaurantId);
    
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
    syncAndSave();
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
    syncAndSave();
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
    syncAndSave();
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
    syncAndSave();
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
    syncAndSave();
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
    syncAndSave();
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
        syncAndSave();
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
    syncAndSave();
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

app.get('/api/sse-status', (req, res) => {
    res.json({
        connected: adminClients.size > 0,
        clients: adminClients.size,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// GOOGLE OAUTH
// ============================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || '/callback',
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    let user = users.find(u => u.googleId === profile.id);
    if (!user) {
        user = {
            id: users.length + 1,
            googleId: profile.id,
            displayName: profile.displayName || 'User',
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : '',
            photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
            role: users.length === 0 ? 'admin' : 'customer'
        };
        users.push(user);
        syncAndSave();
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
    passport.authenticate('google', { 
        failureRedirect: '/login-failed',
        failureMessage: true
    }),
    function(req, res) {
        try {
            const restaurantId = req.query.restaurant || 
                               req.session.restaurantId || 
                               'restaurant-1';
            
            req.session.restaurantId = restaurantId;
            
            req.session.save(function(err) {
                if (err) {
                    console.error('Session save error:', err);
                    return res.redirect('/login-failed');
                }
                
                if (req.user && req.user.role === 'admin') {
                    res.redirect('/admin?restaurant=' + restaurantId);
                } else {
                    res.redirect('/?restaurant=' + restaurantId);
                }
            });
        } catch(error) {
            console.error('Callback error:', error);
            res.redirect('/login-failed');
        }
    }
);

app.get('/login-failed', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Login Failed</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #0a0a0f; color: #e0e0e0; }
                h1 { color: #e74c3c; }
                .btn { display: inline-block; padding: 12px 30px; background: #4285f4; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .btn:hover { background: #3367d6; }
            </style>
        </head>
        <body>
            <h1>🔐 Login Failed</h1>
            <p>There was an error logging in. Please try again.</p>
            <a href="/auth/google" class="btn">Try Again</a>
            <br><br>
            <a href="/" style="color: #b2bec3;">Go Home</a>
        </body>
        </html>
    `);
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });
});

// ============================================
// SERVE HTML PAGES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'admin.html'));
});

app.get('/staff', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'staff.html'));
});

app.get('/create-restaurant', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'create-restaurant.html'));
});

app.get('/pixelpanel', (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(404).send('Page Not Found');
    }
    res.sendFile(path.join(__dirname, 'Public', 'pixelpanel.html'));
});

// ============================================
// TEST ENDPOINT
// ============================================
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        user: req.user ? req.user.displayName : 'Not logged in',
        restaurantId: req.restaurantId,
        restaurants: restaurants.length,
        discountAmount: RESTAURANT_CONFIG.discountAmount,
        discountThreshold: RESTAURANT_CONFIG.discountThreshold,
        sseClients: adminClients.size,
        isOpen: RESTAURANT_CONFIG.isOpen,
        cancellationTimeLimit: RESTAURANT_CONFIG.cancellationTimeLimit,
        deletedOrders: deletedOrders.length,
        lastBackup: data.lastBackup || 'Never'
    });
});

// ============================================
// START SERVER
// ============================================
loadData();
createDefaultRestaurant();
getOrCreateRestaurant('restaurant-2');

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log(`🍔 ${RESTAURANT_CONFIG.name} SERVER RUNNING`);
    console.log('========================================');
    console.log(`📱 Customer: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
    console.log(`👨‍🍳 Staff: http://localhost:${PORT}/staff`);
    console.log('========================================');
    console.log(`💰 Discount: ${RESTAURANT_CONFIG.discountAmount} on ${RESTAURANT_CONFIG.discountThreshold}+`);
    console.log(`🕐 Restaurant: ${RESTAURANT_CONFIG.isOpen ? 'OPEN' : 'CLOSED'} (${RESTAURANT_CONFIG.openingTime} - ${RESTAURANT_CONFIG.closingTime})`);
    console.log(`⏱️ Cancellation Time Limit: ${RESTAURANT_CONFIG.cancellationTimeLimit} minutes`);
    console.log(`📊 Restaurants: ${restaurants.length}`);
    console.log(`👤 Users: ${users.length}`);
    console.log(`📦 Orders: ${restaurants.reduce((sum, r) => sum + r.orders.length, 0)}`);
    console.log(`🗑️ Deleted Orders: ${deletedOrders.length}`);
    console.log(`💾 Last Backup: ${data.lastBackup || 'Never'}`);
    console.log('========================================');
    console.log('✅ Server is ready!');
    console.log('========================================');
});

process.on('SIGINT', () => {
    console.log('🛑 Saving data before shutdown...');
    createAutoBackup();
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Saving data before shutdown...');
    createAutoBackup();
    saveData();
    process.exit(0);
});

module.exports = app;