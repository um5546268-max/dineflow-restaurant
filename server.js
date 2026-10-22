
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// SUPABASE DATABASE CONNECTION
// ============================================
if (!process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable'
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

// ============================================
// RESTAURANT CONFIGURATION
// ============================================
let RESTAURANT_CONFIG = {
    name: 'Sangat Cafe',
    est: '2022',
    address: 'Chak no 275 j Pensra FSD road near Haier Plaza',
    phone: '03001060275',
    whatsapp: '923001060275',
    currency: 'Rs',
    discountAmount: 0,
    discountThreshold: 0,
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



async function loadData() {
    try {
        const { data: cloudRow, error } = await supabase
            .from('restaurant_data')
            .select('id, data, updated_at')
            .eq('id', 'main')
            .maybeSingle();

        if (error) throw error;

        if (cloudRow && cloudRow.data) {
            const cloudData = cloudRow.data;

            if (!Array.isArray(cloudData.restaurants)) {
                throw new Error(
                    'Supabase data is missing the restaurants array. Check the database before continuing.'
                );
            }

            data = { ...data, ...cloudData };
            console.log('✅ Data loaded from Supabase');
        } else {
            if (!fs.existsSync(DATA_FILE)) {
                throw new Error(
                    'No Supabase data or local data.json found. Cannot safely initialize.'
                );
            }

            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            const localData = JSON.parse(fileContent);

            if (!Array.isArray(localData.restaurants)) {
                throw new Error(
                    'Local data.json is missing the restaurants array.'
                );
            }

            const mainRestaurant = localData.restaurants.find(
                r => r.restaurantId === 'restaurant-1'
            );

            if (
                !mainRestaurant ||
                !Array.isArray(mainRestaurant.menu) ||
                !Array.isArray(mainRestaurant.deals) ||
                mainRestaurant.menu.length === 0
            ) {
                throw new Error(
                    'Local data.json does not contain a valid restaurant-1 menu and deals. Migration stopped to protect your data.'
                );
            }

            data = { ...data, ...localData };

            const { error: migrationError } = await supabase
                .from('restaurant_data')
                .upsert(
                    {
                        id: 'main',
                        data: data,
                        updated_at: new Date().toISOString()
                    },
                    { onConflict: 'id' }
                );

            if (migrationError) throw migrationError;

            console.log('✅ Local data migrated to Supabase');
            console.log(`🍽️ Menu items found: ${mainRestaurant.menu.length}`);
            console.log(`🎁 Deals found: ${mainRestaurant.deals.length}`);
        }

        if (data.restaurantConfig) {
            RESTAURANT_CONFIG = data.restaurantConfig;
        }

        data.receiptSettings = { ...(data.receiptSettings || {}) };

        if (data.restaurantStatus) {
            RESTAURANT_CONFIG.isOpen = data.restaurantStatus.isOpen;
            RESTAURANT_CONFIG.openingTime =
                data.restaurantStatus.openingTime;
            RESTAURANT_CONFIG.closingTime =
                data.restaurantStatus.closingTime;
        }

        data.aboutRestaurant = data.aboutRestaurant || {
            description: 'Welcome to Sangat Cafe!',
            photos: [],
            established: '2022',
            ownerName: 'Chef Ali',
            aboutTitle: 'About Sangat Cafe',
            workingHours: 'Mon-Sun: 9:00 AM - 11:00 PM'
        };

        data.lobbyDeals = data.lobbyDeals || [];
        data.deletedOrders = data.deletedOrders || [];
        data.customers = Array.isArray(data.customers) ? data.customers : [];
        data.backupHistory = data.backupHistory || [];

        console.log('📊 Restaurant data loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ Error loading data:', error.message);
        throw error;
    }
}


let saveQueue = Promise.resolve();
let lastSaveError = null;

function saveData() {
    try {
        data.restaurantConfig = RESTAURANT_CONFIG;

        data.receiptSettings = {
            ...(data.receiptSettings || {}),
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
        data.revenueResetAtByRestaurant = revenueResetAtByRestaurant;

        // Capture this version immediately so later changes don't alter it.
        const snapshot = JSON.parse(JSON.stringify(data));

        // Serialize cloud writes, but let each new write continue after an earlier failure.
        saveQueue = saveQueue
            .catch(() => {})
            .then(async () => {
                const { error } = await supabase
                    .from('restaurant_data')
                    .upsert(
                        {
                            id: 'main',
                            data: snapshot,
                            updated_at: new Date().toISOString()
                        },
                        { onConflict: 'id' }
                    );
                if (error) throw error;
                lastSaveError = null;
                console.log('☁️ Data saved to Supabase');
                return true;
            })
            .catch(error => {
                lastSaveError = error;
                console.error('❌ Supabase save failed:', error.message);
                return false;
            });

        return saveQueue;
    } catch (error) {
        console.error('❌ Error preparing data for Supabase:', error);
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

// ============================================
// ⭐ MIDDLEWARE ⭐
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({ 
    origin: true,
    credentials: true 
}));

app.use(express.static(path.join(__dirname, 'Public'), { index: false }));

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
let users = data.users || [];
let restaurants = data.restaurants || [];
let feedbacks = data.feedbacks;
let supportTickets = data.supportTickets;
let availableLayers = data.availableLayers;
let customerLocations = data.customerLocations;
let orderCounter = data.orderCounter || 1;
let receiptSettings = data.receiptSettings;
let aboutRestaurant = data.aboutRestaurant || {
    description: 'Welcome to Sangat Cafe! We serve the best burgers, pizzas, and fast food in town. Our ingredients are always fresh and our service is top-notch. Visit us for an unforgettable dining experience!',
    photos: [],
    established: '2022',
    ownerName: 'Chef Ali',
    aboutTitle: 'About Sangat Cafe',
    workingHours: 'Mon-Sun: 9:00 AM - 11:00 PM'
};
let lobbyDeals = data.lobbyDeals || [];
let deletedOrders = data.deletedOrders || [];
// Persistent customer directory; records are kept even if an order is later deleted.
let customers = Array.isArray(data.customers) ? data.customers : [];
// Persisted per-restaurant revenue reset timestamps (stored in the Supabase JSON row).
let revenueResetAtByRestaurant = data.revenueResetAtByRestaurant || {};

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
    data.customers = customers;
    return saveData();
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
function getNextOrderId(restaurantId) {
    const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
    const activeIds = (restaurant && Array.isArray(restaurant.orders) ? restaurant.orders : [])
        .map(order => Number(order.id)).filter(Number.isFinite);
    const deletedIds = deletedOrders
        .filter(order => String(order.restaurantId || 'restaurant-1') === String(restaurantId))
        .map(order => Number(order.id)).filter(Number.isFinite);
    return Math.max(0, ...activeIds, ...deletedIds) + 1;
}

// Repair duplicate IDs left by older versions that reused orders.length + 1.
// Active orders keep their IDs where possible; duplicates and deleted-order collisions get fresh IDs.
function repairDuplicateOrderIds() {
    const usedByRestaurant = new Map();
    const maxByRestaurant = new Map();
    const activeRefs = [];
    const deletedRefs = [];

    for (const restaurant of restaurants) {
        const restaurantId = String(restaurant.restaurantId || 'restaurant-1');
        restaurant.orders = Array.isArray(restaurant.orders) ? restaurant.orders : [];
        for (const order of restaurant.orders) {
            order.restaurantId = restaurantId;
            activeRefs.push({ order, restaurantId });
        }
    }
    for (const order of deletedOrders) {
        const restaurantId = String(order.restaurantId || 'restaurant-1');
        order.restaurantId = restaurantId;
        deletedRefs.push({ order, restaurantId });
    }
    for (const ref of [...activeRefs, ...deletedRefs]) {
        const id = Number(ref.order.id);
        if (Number.isFinite(id)) maxByRestaurant.set(ref.restaurantId, Math.max(maxByRestaurant.get(ref.restaurantId) || 0, id));
    }

    let changed = false;
    for (const ref of [...activeRefs, ...deletedRefs]) {
        let used = usedByRestaurant.get(ref.restaurantId);
        if (!used) { used = new Set(); usedByRestaurant.set(ref.restaurantId, used); }
        const id = Number(ref.order.id);
        if (Number.isFinite(id) && !used.has(id)) {
            used.add(id);
            continue;
        }
        const next = (maxByRestaurant.get(ref.restaurantId) || 0) + 1;
        maxByRestaurant.set(ref.restaurantId, next);
        ref.order.id = next;
        used.add(next);
        changed = true;
    }
    return changed;
}

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

function getPakistanBusinessDayBounds(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const values = {};
    for (const part of parts) if (part.type !== 'literal') values[part.type] = part.value;
    let year = Number(values.year), month = Number(values.month), day = Number(values.day);
    if (Number(values.hour) < 16) {
        const previous = new Date(Date.UTC(year, month - 1, day) - 86400000);
        year = previous.getUTCFullYear(); month = previous.getUTCMonth() + 1; day = previous.getUTCDate();
    }
    const start = Date.UTC(year, month - 1, day, 11, 0, 0); // 4 PM Pakistan time
    return { start, end: start + 86400000 };
}

function getOrderTimestampMs(order) {
    const value = order && (order.createdAt || order.deviceTimestamp || order.date);
    if (!value) return NaN;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
}

app.delete('/api/orders/:id', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const orderId = Number.parseInt(req.params.id, 10);
    const index = restaurant.orders.findIndex(o => Number(o.id) === orderId);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Order not found' });
    }
    
    const deletedOrder = restaurant.orders[index];
    restaurant.orders.splice(index, 1);
    
    deletedOrder.deletedAt = new Date().toISOString();
    deletedOrder.deletedBy = req.user.displayName || 'Admin';
    deletedOrder.restaurantId = restaurantId;
    deletedOrders.push(deletedOrder);
    
    await syncAndSave();
    if (lastSaveError) return res.status(500).json({ error: 'Order was removed in memory but could not be saved to cloud storage. Check Render logs and Supabase credentials.' });
    
    broadcastOrderUpdate({ ...deletedOrder, status: 'deleted' }, restaurantId);
    
    res.json({ 
        success: true, 
        message: 'Order deleted and backed up',
        orderId: deletedOrder.id
    });
});

app.delete('/api/orders/today/all', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    
    const bounds = getPakistanBusinessDayBounds();
    const ordersToDelete = restaurant.orders.filter(o => {
        const timestamp = getOrderTimestampMs(o);
        return Number.isFinite(timestamp) && timestamp >= bounds.start && timestamp < bounds.end;
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
        const timestamp = getOrderTimestampMs(o);
        return !Number.isFinite(timestamp) || timestamp < bounds.start || timestamp >= bounds.end;
    });
    
    await syncAndSave();
    if (lastSaveError) return res.status(500).json({ error: 'Orders could not be saved to cloud storage.' });
    
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
    
    const bounds = getPakistanBusinessDayBounds();
    const todayOrders = restaurant.orders.filter(o => {
        const timestamp = getOrderTimestampMs(o);
        return Number.isFinite(timestamp) && timestamp >= bounds.start && timestamp < bounds.end;
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

    res.json(
        Array.isArray(restaurant.menu)
            ? restaurant.menu
            : getDefaultMenu()
    );
});

app.get('/api/deals', (req, res) => {
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);

    res.json(
        Array.isArray(restaurant.deals)
            ? restaurant.deals
            : getDefaultDeals()
    );
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
        id: restaurant.menu.length > 0
    ? Math.max(...restaurant.menu.map(item => Number(item.id) || 0)) + 1
    : 1,
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


app.post('/api/menu/fix-drink-ids', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);

    const drink15 = restaurant.menu.find(
        item => item.name === '1.5 (LTR) Drink' &&
                item.category === 'drinks'
    );

    const drink1 = restaurant.menu.find(
        item => item.name === '1 (LTR) Drink' &&
                item.category === 'drinks'
    );

    if (!drink15 || !drink1) {
        return res.status(404).json({
            error: 'Could not find both drinks. No changes made.'
        });
    }

    if (String(drink15.id) !== String(drink1.id)) {
        return res.json({
            success: true,
            message: 'The two drinks already have different IDs.',
            drinks: [
                { id: drink15.id, name: drink15.name },
                { id: drink1.id, name: drink1.name }
            ]
        });
    }

    const usedIds = new Set(
        restaurant.menu
            .filter(item => item !== drink15)
            .map(item => String(item.id))
    );

    let newId = 1;
    while (usedIds.has(String(newId))) {
        newId++;
    }

    drink15.id = newId;

    syncAndSave();

    res.json({
        success: true,
        message: 'Drink ID corrected. Save was queued.',
        drinks: [
            { id: drink15.id, name: drink15.name, price: drink15.price },
            { id: drink1.id, name: drink1.name, price: drink1.price }
        ]
    });
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
// ============================================
// CUSTOMER MEMORY / DIRECTORY
// ============================================
function normalizeCustomerPhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function upsertCustomerFromOrder(restaurantId, order) {
    const name = String(order.userName || order.name || '').trim();
    const phone = String(order.phone || '').trim();
    const address = String(order.address || '').trim();
    if (!name && !phone) return;

    const phoneKey = normalizeCustomerPhone(phone);
    const nameKey = name.toLocaleLowerCase();
    let customer = customers.find(c =>
        String(c.restaurantId || 'restaurant-1') === String(restaurantId) &&
        ((phoneKey && normalizeCustomerPhone(c.phone) === phoneKey) ||
         (!phoneKey && nameKey && String(c.name || '').trim().toLocaleLowerCase() === nameKey))
    );

    if (!customer) {
        customer = {
            id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            restaurantId,
            name,
            phone,
            address,
            email: String(order.email || '').trim(),
            userId: order.userId || null,
            orderIds: [],
            totalOrders: 0,
            totalSpent: 0,
            firstOrderAt: order.createdAt || order.deviceTimestamp || new Date().toISOString(),
            lastOrderAt: order.createdAt || order.deviceTimestamp || new Date().toISOString(),
            lastOrderType: order.orderType || '',
            notes: ''
        };
        customers.push(customer);
    }

    // Update details when the customer provides newer information.
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (address && address !== 'In-store pickup') customer.address = address;
    if (order.email) customer.email = String(order.email).trim();
    if (order.userId) customer.userId = order.userId;
    customer.lastOrderAt = order.createdAt || order.deviceTimestamp || new Date().toISOString();
    customer.lastOrderType = order.orderType || customer.lastOrderType || '';
    customer.orderIds = Array.isArray(customer.orderIds) ? customer.orderIds : [];
    const orderKey = `${restaurantId}:${String(order.id)}:${String(order.createdAt || order.deviceTimestamp || order.date || '')}`;
    if (!customer.orderIds.includes(orderKey)) {
        customer.orderIds.push(orderKey);
        customer.totalOrders = customer.orderIds.length;
        customer.totalSpent = Number(customer.totalSpent || 0) + Number(order.total || 0);
    }
}

function backfillCustomersFromOrders(restaurantId, restaurant) {
    customers = Array.isArray(customers) ? customers : [];
    const history = [
        ...(Array.isArray(restaurant.orders) ? restaurant.orders : []),
        ...(Array.isArray(deletedOrders) ? deletedOrders : []).filter(o =>
            String(o.restaurantId || 'restaurant-1') === String(restaurantId)
        )
    ];
    history.forEach(order => upsertCustomerFromOrder(restaurantId, order));
}

app.get('/api/customers/suggest', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Login required for saved customer suggestions' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    backfillCustomersFromOrders(restaurantId, restaurant);
    const q = String(req.query.q || '').trim().toLocaleLowerCase();
    const digits = normalizeCustomerPhone(q);
    if (!q) return res.json([]);

    // Admin/staff can use the directory at the POS. Customers only see their own saved details.
    const visible = ['admin', 'staff'].includes(String(req.user.role || '').toLowerCase())
        ? customers.filter(c => String(c.restaurantId) === String(restaurantId))
        : customers.filter(c => String(c.restaurantId) === String(restaurantId) && String(c.userId) === String(req.user.id));
    const matches = visible.filter(c =>
        String(c.name || '').toLocaleLowerCase().includes(q) ||
        String(c.phone || '').toLocaleLowerCase().includes(q) ||
        (digits && normalizeCustomerPhone(c.phone).includes(digits))
    ).sort((a, b) => String(b.lastOrderAt || '').localeCompare(String(a.lastOrderAt || ''))).slice(0, 8);
    res.json(matches.map(c => ({ name: c.name || '', phone: c.phone || '', address: c.address || '', email: c.email || '' })));
});

app.get('/api/admin/customers', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    backfillCustomersFromOrders(restaurantId, restaurant);
    syncAndSave();
    const result = customers.filter(c => String(c.restaurantId) === String(restaurantId))
        .sort((a, b) => String(b.lastOrderAt || '').localeCompare(String(a.lastOrderAt || '')))
        .map(c => ({
            id: c.id, name: c.name || '', phone: c.phone || '', address: c.address || '',
            email: c.email || '', totalOrders: Number(c.totalOrders || 0),
            totalSpent: Number(c.totalSpent || 0), firstOrderAt: c.firstOrderAt || '',
            lastOrderAt: c.lastOrderAt || '', lastOrderType: c.lastOrderType || '', notes: c.notes || ''
        }));
    res.json({ customers: result, count: result.length });
});

app.post('/api/orders', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);

    // Idempotency: a retried checkout must return the order already saved.
    // This check runs before opening-hours validation so a retry still succeeds
    // even if the restaurant closes after the original request was accepted.
    const requestKey = typeof req.body?.idempotencyKey === 'string'
        ? req.body.idempotencyKey.trim().slice(0, 160)
        : '';
    if (requestKey) {
        const existingOrder = restaurant.orders.find(order =>
            order.idempotencyKey === requestKey &&
            String(order.userId) === String(req.user.id)
        );
        if (existingOrder) {
            return res.status(200).json({
                message: 'Order already placed',
                order: existingOrder,
                duplicate: true
            });
        }
    }
    
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
    
    
const {
    items, total, subtotal, name, phone, address, layers,
    orderType, paymentMethod, lat, lng, table,
    deviceTime, deviceTimestamp, idempotencyKey
} = req.body;

if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
}

// Count the selected layers and calculate the fee on the server.
const selectedLayers = Array.isArray(layers) ? layers : [];
const selectedLayerCount = selectedLayers.length;
const layerExtraCharge = selectedLayerCount * 100;

// Use the original subtotal when supplied, preventing double-charging.

const baseTotal = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 1;
    return sum + price * qty;
}, 0);

if (!Number.isFinite(baseTotal) || baseTotal <= 0) {
    return res.status(400).json({ error: 'Invalid order total' });
}

const finalTotal = baseTotal + layerExtraCharge;
    
    const newOrder = {
        id: getNextOrderId(restaurantId),
        userId: req.user.id,
        userName: name || req.user.displayName,
        email: req.user.email || '',
        phone: phone || '',
        address: address || 'In-store pickup',
        items: items,
layers: selectedLayers,
subtotal: baseTotal,
layerExtraCharge: layerExtraCharge,
selectedLayerCount: selectedLayerCount,
total: finalTotal,
        status: 'pending',
        orderType: orderType || 'delivery',
        paymentMethod: paymentMethod || 'cash',
        date: new Date().toLocaleString(),
        createdAt: new Date(),
        restaurantId: restaurantId,
        ...(requestKey ? { idempotencyKey: requestKey } : {}),
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
    upsertCustomerFromOrder(restaurantId, newOrder);
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

// Admin order editor: update customer/order details without changing the order ID,
// status, original timestamps, ownership, or revenue-reset metadata.
app.put('/api/orders/:id/edit', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });

    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) return res.status(400).json({ error: 'Invalid order ID' });
    const order = restaurant.orders.find(o => Number(o.id) === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    try {
        const body = req.body || {};
        const name = String(body.userName ?? order.userName ?? '').trim().slice(0, 120);
        const phone = String(body.phone ?? order.phone ?? '').trim().slice(0, 40);
        const address = String(body.address ?? order.address ?? '').trim().slice(0, 500);
        const orderType = String(body.orderType ?? order.orderType ?? 'delivery');
        const paymentMethod = String(body.paymentMethod ?? order.paymentMethod ?? 'cash').trim().slice(0, 60);
        const table = String(body.table ?? order.table ?? '').trim().slice(0, 40);
        const allowedTypes = ['delivery', 'takeaway', 'dinein'];
        if (!allowedTypes.includes(orderType)) {
            return res.status(400).json({ error: 'Invalid order type' });
        }
        if (!name) return res.status(400).json({ error: 'Customer name is required' });
        if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
            return res.status(400).json({ error: 'An order must contain between 1 and 100 items' });
        }

        const items = [];
        for (const raw of body.items) {
            const itemName = String(raw?.name ?? '').trim().slice(0, 160);
            const price = Number(raw?.price);
            const qty = Number(raw?.qty);
            if (!itemName || !Number.isFinite(price) || price < 0 || price > 10000000 ||
                !Number.isInteger(qty) || qty < 1 || qty > 999) {
                return res.status(400).json({ error: 'Each item needs a name, valid price, and quantity from 1 to 999' });
            }
            items.push({ ...raw, name: itemName, price, qty });
        }

        const layers = Array.isArray(body.layers)
            ? body.layers.map(layer => String(layer).trim()).filter(Boolean).slice(0, 30)
            : (Array.isArray(order.layers) ? order.layers : []);
        const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const layerExtraCharge = layers.length * 100;
        const discountThreshold = Number(RESTAURANT_CONFIG.discountThreshold) || 0;
        const discountAmount = Number(RESTAURANT_CONFIG.discountAmount) || 0;
        const discount = subtotal > discountThreshold ? discountAmount : 0;
        const total = Math.max(0, subtotal + layerExtraCharge - discount);

        order.userName = name;
        order.phone = phone;
        order.address = address;
        order.orderType = orderType;
        order.paymentMethod = paymentMethod || 'cash';
        order.table = table || null;
        order.items = items;
        order.layers = layers;
        order.subtotal = subtotal;
        order.layerExtraCharge = layerExtraCharge;
        order.selectedLayerCount = layers.length;
        order.total = total;
        order.adminEditedAt = new Date().toISOString();
        order.adminEditedBy = req.user.id || req.user.email || 'admin';

        syncAndSave();
        broadcastOrderUpdate(order, restaurantId);
        return res.json({ success: true, message: `Order #${order.id} updated`, order });
    } catch (error) {
        console.error('Edit order error:', error);
        return res.status(500).json({ error: 'Failed to update order' });
    }
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

app.put('/api/orders/:id/status', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'Invalid order ID' });
    const matches = restaurant.orders.filter(o => Number(o.id) === orderId);
    if (matches.length > 1) return res.status(409).json({ error: 'Duplicate order ID detected. Refresh the admin page after the server repairs order IDs.' });
    const order = matches[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const status = req.body && req.body.status;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const previousStatus = order.status;
    const previousStatusUpdatedAt = order.statusUpdatedAt;
    order.status = status;
    order.statusUpdatedAt = new Date().toISOString();
    const saved = await syncAndSave();
    if (saved !== true) {
        order.status = previousStatus;
        if (previousStatusUpdatedAt === undefined) delete order.statusUpdatedAt;
        else order.statusUpdatedAt = previousStatusUpdatedAt;
        await syncAndSave(); // Best-effort persistence of the rollback.
        return res.status(500).json({ error: 'Order status was not saved. Please try again; check Render logs if it continues.' });
    }
    broadcastOrderUpdate(order, restaurantId);
    return res.json({ success: true, order });
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
    const secondAdminEmail = (
    process.env.SECOND_ADMIN_EMAIL || ''
).trim().toLowerCase();

const loginEmail = (
    profile.emails && profile.emails[0]
        ? profile.emails[0].value
        : ''
).trim().toLowerCase();

if (user && secondAdminEmail && loginEmail === secondAdminEmail) {
    if (user.role !== 'admin') {
        user.role = 'admin';
        user.email = loginEmail;
        syncAndSave();
        console.log('Second admin authorized.');
    }
}
    if (!user) {
        user = {
            id: users.length + 1,
            googleId: profile.id,
            displayName: profile.displayName || 'User',
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : '',
            photo: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
            role: (
    users.length === 0 ||
    (profile.emails && profile.emails[0] &&
     profile.emails[0].value.trim().toLowerCase() ===
     (process.env.SECOND_ADMIN_EMAIL || '').trim().toLowerCase())
) ? 'admin' : 'customer'
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
    const customerPage = path.join(__dirname, 'Public', 'index.html');
    fs.readFile(customerPage, 'utf8', (error, html) => {
        if (error) return res.status(500).send('Could not load customer page.');
        const customerMemoryScript = `
<script id="sangat-customer-memory-script">
(function () {
  if (window.__sangatCustomerMemoryLoaded) return;
  window.__sangatCustomerMemoryLoaded = true;
  let timer;
  let activeInput = null;
  let popup = null;
  function fields(anchor) {
    const scope = anchor && anchor.closest('form') ? anchor.closest('form') : document;
    const inputs = Array.from(scope.querySelectorAll('input, textarea'));
    const descriptor = el => [el.id, el.name, el.placeholder, el.getAttribute('aria-label') || ''].join(' ').toLowerCase();
    const find = pattern => inputs.find(el => pattern.test(descriptor(el)));
    return {
      name: find(/customer.?name|user.?name|full.?name|your.?name/) || find(/(^|\\s)name($|\\s)/),
      phone: find(/phone|mobile|contact|telephone|number/),
      address: find(/address|delivery.?location/),
      email: find(/email/)
    };
  }
  function ensurePopup() {
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = 'sangatCustomerMemoryPopup';
    popup.style.cssText = 'position:absolute;z-index:999999;display:none;max-height:240px;overflow:auto;background:#fff;color:#222;border:1px solid #ddd;border-radius:10px;box-shadow:0 8px 25px #0002;min-width:240px;font:14px Arial,sans-serif;';
    document.body.appendChild(popup);
    document.addEventListener('click', e => { if (popup && !popup.contains(e.target) && e.target !== activeInput) popup.style.display = 'none'; });
    return popup;
  }
  function placePopup(input) {
    const p = ensurePopup(); const r = input.getBoundingClientRect();
    p.style.left = (r.left + window.scrollX) + 'px';
    p.style.top = (r.bottom + window.scrollY + 4) + 'px';
    p.style.minWidth = Math.max(240, r.width) + 'px';
  }
  async function search(input) {
    const query = input.value.trim();
    const p = ensurePopup(); activeInput = input;
    if (query.length < 2) { p.style.display = 'none'; return; }
    try {
      const url = '/api/customers/suggest?restaurant=' + encodeURIComponent(new URLSearchParams(location.search).get('restaurant') || 'restaurant-1') + '&q=' + encodeURIComponent(query);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) { p.style.display = 'none'; return; }
      const result = await response.json();
      p.replaceChildren();
      if (!result.length) { p.style.display = 'none'; return; }
      result.forEach(customer => {
        const item = document.createElement('button');
        item.type = 'button';
        item.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-bottom:1px solid #eee;background:#fff;color:#222;cursor:pointer;';
        item.innerHTML = '';
        const title = document.createElement('div'); title.textContent = customer.name || customer.phone || 'Saved customer'; title.style.fontWeight = '700';
        const detail = document.createElement('div'); detail.textContent = [customer.phone, customer.address].filter(Boolean).join(' • '); detail.style.cssText = 'font-size:12px;color:#666;margin-top:3px;';
        item.append(title, detail);
        item.addEventListener('mousedown', e => {
          e.preventDefault(); const f = fields();
          if (f.name) f.name.value = customer.name || '';
          if (f.phone) f.phone.value = customer.phone || '';
          if (f.address) f.address.value = customer.address || '';
          if (f.email && customer.email) f.email.value = customer.email;
          [f.name, f.phone, f.address, f.email].filter(Boolean).forEach(el => el.dispatchEvent(new Event('input', {bubbles:true})));
          p.style.display = 'none';
        });
        p.appendChild(item);
      });
      placePopup(input); p.style.display = 'block';
    } catch (e) { console.debug('Customer suggestions unavailable', e); }
  }
  function attach() {
    document.querySelectorAll('input, textarea').forEach(input => {
      if (input.dataset.sangatMemoryBound) return;
      const descriptor = [input.id, input.name, input.placeholder, input.getAttribute('aria-label') || ''].join(' ').toLowerCase();
      if (!/(customer.?name|user.?name|full.?name|your.?name|phone|mobile|contact|telephone|number)/.test(descriptor) && !/(^|\\s)name($|\\s)/.test(descriptor)) return;
      input.dataset.sangatMemoryBound = '1';
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search(input), 220); });
      input.addEventListener('focus', () => { if (input.value.trim().length >= 2) search(input); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;
        if (html.includes('</body>')) html = html.replace('</body>', customerMemoryScript + '\n</body>');
        else html += customerMemoryScript;
        res.type('html').send(html);
    });
});

// Sangat Cafe Android App Download Page
app.get('/download', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'download.html'));
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
 // ADMIN REVENUE PASSWORD VERIFICATION
 // ============================================
// ============================================
// PERSISTENT ADMIN REVENUE SUMMARY + RESET
// Today's Revenue includes orders created since the saved reset moment
// only after they are confirmed; pending/cancelled orders do not count.
// Total Revenue remains the sum of all historical, non-cancelled orders.
// ============================================
function getRevenueOrderTimestamp(order) {
    const raw = order.createdAt || order.deviceTimestamp || order.date;
    if (!raw) return NaN;
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
}

function isRevenueCountedOrder(order) {
    return !['pending', 'cancelled'].includes(String(order.status || '').toLowerCase());
}

app.get('/api/admin/revenue-summary', (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required.' });
    }
    const restaurantId = req.restaurantId || 'restaurant-1';
    const restaurant = getOrCreateRestaurant(restaurantId);
    let resetValue = revenueResetAtByRestaurant[restaurantId];
    // If no reset marker exists yet, establish a persistent starting point now.
    // This prevents old orders from suddenly appearing as today's revenue.
    if (!resetValue) {
        resetValue = new Date().toISOString();
        revenueResetAtByRestaurant[restaurantId] = resetValue;
        data.revenueResetAtByRestaurant = revenueResetAtByRestaurant;
        syncAndSave();
    }
    const resetAt = new Date(resetValue).getTime();
    // Preserve the existing Total Revenue behavior: all historical orders count.
    const totalRevenue = restaurant.orders.reduce(
        (sum, order) => sum + (Number(order.total) || 0),
        0
    );
    const todayRevenue = restaurant.orders.reduce((sum, order) => {
        const timestamp = getRevenueOrderTimestamp(order);
        if (!Number.isFinite(timestamp) || timestamp < resetAt || !isRevenueCountedOrder(order)) return sum;
        return sum + (Number(order.total) || 0);
    }, 0);
    return res.json({
        success: true,
        restaurantId,
        resetAt: resetValue || null,
        totalRevenue,
        todayRevenue
    });
});

app.post('/api/admin/reset-todays-revenue', (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required.' });
    }
    const restaurantId = req.restaurantId || 'restaurant-1';
    revenueResetAtByRestaurant[restaurantId] = new Date().toISOString();
    data.revenueResetAtByRestaurant = revenueResetAtByRestaurant;
    syncAndSave();
    return res.json({ success: true, resetAt: revenueResetAtByRestaurant[restaurantId] });
});

app.post('/api/admin/verify-balance-password', (req, res) => {
    // Only a logged-in admin may verify the balance password.
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required.'
        });
    }

    const configuredPassword = process.env.BALANCE_PASSWORD;
    const submittedPassword = req.body && req.body.password;

    // Fail closed if the Render environment variable is missing.
    if (!configuredPassword) {
        console.error('BALANCE_PASSWORD is not configured.');
        return res.status(503).json({
            success: false,
            error: 'Balance password is not configured on the server.'
        });
    }

    if (typeof submittedPassword !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Please enter the balance password.'
        });
    }

    // Compare fixed-length hashes to avoid a length mismatch error.
    const expectedHash = crypto
        .createHash('sha256')
        .update(configuredPassword, 'utf8')
        .digest();

    const submittedHash = crypto
        .createHash('sha256')
        .update(submittedPassword, 'utf8')
        .digest();

    if (!crypto.timingSafeEqual(expectedHash, submittedHash)) {
        return res.status(401).json({
            success: false,
            error: 'Incorrect password.'
        });
    }

    return res.json({ success: true });
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
async function initializeApp() {
    try {
        // STEP 1: Load saved data from Supabase.

        const loaded = await loadData();

        if (!loaded) {
            throw new Error('Restaurant data could not be loaded.');
        }

        // STEP 2: Normalize loaded data safely.
        data.users = Array.isArray(data.users) ? data.users : [];
        data.restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
        data.feedbacks = Array.isArray(data.feedbacks) ? data.feedbacks : [];
        data.supportTickets = Array.isArray(data.supportTickets) ? data.supportTickets : [];
        data.availableLayers = Array.isArray(data.availableLayers) ? data.availableLayers : [];
        data.customerLocations = Array.isArray(data.customerLocations) ? data.customerLocations : [];
        data.orderCounter = Number(data.orderCounter) || 1;
        data.receiptSettings = { ...(data.receiptSettings || {}) };
        data.lobbyDeals = Array.isArray(data.lobbyDeals) ? data.lobbyDeals : [];
        data.deletedOrders = Array.isArray(data.deletedOrders) ? data.deletedOrders : [];
        data.customers = Array.isArray(data.customers) ? data.customers : [];
        data.backupHistory = Array.isArray(data.backupHistory) ? data.backupHistory : [];

        // STEP 3: Restore saved restaurant configuration.
        RESTAURANT_CONFIG = data.restaurantConfig || RESTAURANT_CONFIG;

        // STEP 4: Reconnect variables to loaded data.
        users = data.users;
        restaurants = data.restaurants;
        feedbacks = data.feedbacks;
        supportTickets = data.supportTickets;
        availableLayers = data.availableLayers;
        customerLocations = data.customerLocations;
        orderCounter = data.orderCounter;
        receiptSettings = data.receiptSettings;

        aboutRestaurant = data.aboutRestaurant || {
            description: 'Welcome to Sangat Cafe!',
            photos: [],
            established: '2022',
            ownerName: 'Chef Ali',
            aboutTitle: 'About Sangat Cafe',
            workingHours: 'Mon-Sun: 9:00 AM - 11:00 PM'
        };

        lobbyDeals = data.lobbyDeals;
        deletedOrders = data.deletedOrders;
        customers = data.customers;
        data.aboutRestaurant = aboutRestaurant;

        // Repair old duplicate order IDs so every status/edit/delete action targets one order.
        const repairedOrderIds = repairDuplicateOrderIds();
        if (repairedOrderIds) {
            console.warn('⚠️ Repaired duplicate order IDs from older orders.');
            await syncAndSave();
        }

        // STEP 5: Create or restore restaurant records.
        createDefaultRestaurant();
        getOrCreateRestaurant('restaurant-2');

        // STEP 6: Start automatic saving only after loading.
        setInterval(() => {
            saveData();
        }, 30000);

        // STEP 7: Print startup information.
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
        console.log(`📦 Orders: ${restaurants.reduce((sum, r) => sum + (r.orders || []).length, 0)}`);
        console.log(`🗑️ Deleted Orders: ${deletedOrders.length}`);
        console.log(`💾 Last Backup: ${data.lastBackup || 'Never'}`);
        console.log('========================================');
        console.log('✅ Server is ready!');
        console.log('========================================');

        // STEP 8: Start the server exactly once.
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server listening on port ${PORT}`);
        });

    } catch (error) {
        console.error('❌ App initialization failed:', error);
        process.exit(1);
    }
}

initializeApp();
