
(async function SangatCafeMenuImporter() {
    'use strict';

    const RESTAURANT_ID = 'restaurant-1';
    const BASE_URL = window.location.origin;
    const STORAGE_KEY = 'sangat_cafe_bulk_import_v1_restaurant_1';

    // Safety: only run from the logged-in admin page.
    if (!/\/admin\/?$/.test(window.location.pathname)) {
        alert('Open the Sangat Cafe Admin page before running this importer.');
        return;
    }

    if (new URLSearchParams(window.location.search).get('restaurant') !== RESTAURANT_ID) {
        alert('This importer is configured for restaurant-1. Open the correct Admin URL.');
        return;
    }

    if (window.__SANGAT_IMPORT_RUNNING__) {
        alert('The Sangat Cafe importer is already running.');
        return;
    }

    if (localStorage.getItem(STORAGE_KEY)) {
        alert(
            'The importer has already been started in this browser for this version.\n\n' +
            'It will not run again automatically, to help prevent duplicate items.\n' +
            'Check the Admin Menu and Deals before taking any further action.'
        );
        return;
    }

    // ---------------------------------------------------------
    // MENU DATA
    // Existing categories taken from your supplied Admin HTML.
    // Every size is expanded into a separate priced menu item.
    // ---------------------------------------------------------

    const menu = [];

    function addSizedItems(flavour, sizes, category, icon) {
        for (const [size, price] of sizes) {
            menu.push({
                name: `${flavour} (${size})`,
                price,
                category,
                icons: [icon],
                layers: []
            });
        }
    }

    const specialPizzaPrices = [
        ['S', 600],
        ['M', 1100],
        ['L', 1400],
        ['XL', 2000]
    ];

    for (const flavour of [
        'Creamy Pizza',
        'Chicken Achari Pizza',
        "Sangat's Special Pizza"
    ]) {
        addSizedItems(flavour, specialPizzaPrices, 'pizza', '🍕');
    }

    addSizedItems('Malai Boti Pizza', [
        ['S', 600], ['M', 1100], ['L', 1450], ['XL', 2000]
    ], 'pizza', '🍕');

    for (const flavour of ['Crunchy Pizza', 'Behari Kabab Pizza']) {
        addSizedItems(flavour, [
            ['M', 1200], ['L', 1600], ['XL', 2150]
        ], 'pizza', '🍕');
    }

    // Crust Pizza
    const crustPrices = [
        ['M', 1200], ['L', 1600], ['XL', 2150]
    ];

    for (const flavour of [
        'Royal Crust Pizza',
        'Kabab Stuffer Pizza',
        'Chicken Stuffer Pizza',
        'Chicken & Cheese Stuffer Pizza',
        'Crispy Chicken Pizza'
    ]) {
        addSizedItems(flavour, crustPrices, 'pizza', '🍕');
    }

    // Butter Lazania Pizza
    addSizedItems('Butter Lazania Pizza', [
        ['M', 1400], ['L', 1750], ['XL', 2400]
    ], 'pizza', '🍕');

    // Traditional Pizza
    const traditionalPizzaPrices = [
        ['S', 550], ['M', 1000], ['L', 1350], ['XL', 1950]
    ];

    for (const flavour of [
        'Chicken Tikka Pizza',
        'Chicken Fajita Pizza',
        'Vegetable Pizza',
        'Hot n Spicy Pizza',
        'Supreme Pizza',
        'Cheese Lover Pizza'
    ]) {
        addSizedItems(flavour, traditionalPizzaPrices, 'pizza', '🍕');
    }

    // Extra Topping
    addSizedItems('Extra Topping', [
        ['S', 120], ['M', 150], ['L', 230], ['XL', 300]
    ], 'pizza', '🧀');

    // Burgers
    const burgers = [
        ['Double Peti Burger', 400],
        ['Chicken Peti Burger', 250],
        ['Chicken Chapli Kabab Burger', 300],
        ['Zinger Burger', 380],
        ['Fillet Burger', 380],
        ['Tower Burger', 600],
        ['Monster Burger', 650],
        ['Pizza Burger', 500],
        ['Extra Cheese', 100]
    ];

    for (const [name, price] of burgers) {
        menu.push({
            name,
            price,
            category: 'burgers',
            icons: ['🍔'],
            layers: []
        });
    }

    // Fries
    const fries = [
        ['Regular Fries', 200],
        ['Family Fries', 300],
        ['Mayo Fries', 350],
        ['Loaded Fries', 550],
        ['Crunchy Fries', 600]
    ];

    for (const [name, price] of fries) {
        menu.push({
            name,
            price,
            category: 'fries_sides',
            icons: ['🍟'],
            layers: []
        });
    }

    // Pasta: separate Half and Full entries
    const pastaItems = [
        ['Special Pasta', 400, 750],
        ['Creamy Pasta', 450, 800],
        ['Crunchy Pasta', 450, 850]
    ];

    for (const [name, halfPrice, fullPrice] of pastaItems) {
        menu.push(
            {
                name: `${name} (Half)`,
                price: halfPrice,
                category: 'pasta',
                icons: ['🍝'],
                layers: []
            },
            {
                name: `${name} (Full)`,
                price: fullPrice,
                category: 'pasta',
                icons: ['🍝'],
                layers: []
            }
        );
    }

    // Wings & Nuggets
    for (const [name, price] of [
        ['Hot Wings', 600],
        ['Oven Baked Wings', 650],
        ['Nuggets', 600]
    ]) {
        menu.push({
            name,
            price,
            category: 'wings_nuggets',
            icons: ['🍗'],
            layers: []
        });
    }

    // Rolls
    for (const [name, price] of [
        ['Spin Rolls', 500],
        ['Malai Rolls', 500],
        ['Arabic Rolls', 500],
        ['Extra Dip', 60]
    ]) {
        menu.push({
            name,
            price,
            category: name === 'Extra Dip' ? 'sauces' : 'rolls',
            icons: [name === 'Extra Dip' ? '🥣' : '🌯'],
            layers: []
        });
    }

    // Shawarma
    for (const [name, price] of [
        ['Chicken Shawarma', 180],
        ['Cheese Shawarma', 250],
        ['Arabic Shawarma', 250],
        ['Zinger Shawarma', 300],
        ['Zinger Cheese Shawarma', 340],
        ['Malai Boti Shawarma', 340],
        ['Shawarma Platter', 380]
    ]) {
        menu.push({
            name,
            price,
            category: name === 'Shawarma Platter' ? 'platters' : 'shawarma',
            icons: ['🌯'],
            layers: []
        });
    }

    // Paratha Roll
    for (const [name, price] of [
        ['Chicken Paratha Roll', 300],
        ['Zinger Paratha Roll', 330],
        ['Cheese Roll', 350],
        ['Arabic Paratha Roll', 350],
        ['Zinger Cheese Roll', 380],
        ['Malai Boti Roll', 380],
        ['Kabab Paratha Roll', 380]
    ]) {
        menu.push({
            name,
            price,
            category: 'paratha_rolls',
            icons: ['🌯'],
            layers: []
        });
    }

    // Special Platter
    menu.push({
        name: 'Special Platter',
        price: 950,
        category: 'platters',
        icons: ['🍽️'],
        layers: []
    });

    // ---------------------------------------------------------
    // DEAL DATA
    // Deals are sent to /api/deals, never /api/menu.
    // Original price is null because none was supplied.
    // ---------------------------------------------------------

    const deals = [
        {
            name: 'Birthday Deal',
            price: 5000,
            desc: '1 XL Pizza (Any Flavour)\n' +
                  '1 L Pizza (Any Flavour)\n' +
                  '3 Zinger Burgers\n' +
                  '2 Fries\n' +
                  '1 PC Cake\n' +
                  '1.5 Liter Drink',
            icons: ['🎂']
        },
        {
            name: 'Deal',
            price: 4300,
            desc: '2 XL Pizzas (Any Flavour)\n1.5 Liter Drink',
            icons: ['🍕']
        },
        {
            name: 'Student Deal',
            price: 1100,
            desc: '2 Small Pizzas (Any Flavour)\n1 Liter Drink',
            icons: ['🎓']
        },
        {
            name: 'Lunch Deal',
            price: 1400,
            desc: 'Available 12:00 to 01:00 PM\n' +
                  '1 Large Pizza (Any Flavour)\n1 Liter Drink',
            icons: ['🍽️']
        },
        {
            name: 'Deal 1',
            price: 600,
            desc: '1 Zinger Burger\n1 Fries\n1 Drink (500 ml)',
            icons: ['🍔']
        },
        {
            name: 'Deal 2',
            price: 1050,
            desc: '1 Zinger Burger\n1 Peti Burger\n1 Fries\n1 Liter Drink',
            icons: ['🍔']
        },
        {
            name: 'Deal 3',
            price: 1400,
            desc: '2 Zinger Burgers\n10 Wings\n1 Liter Drink',
            icons: ['🍗']
        },
        {
            name: 'Deal 4',
            price: 1700,
            desc: '1 Medium Pizza\n3 Chicken Shawarmas\n1 Liter Drink',
            icons: ['🍕']
        },
        {
            name: 'Deal 5',
            price: 2400,
            desc: '1 Large Pizza\n1 Platter\n1 Liter Drink',
            icons: ['🍽️']
        },
        {
            name: 'Deal 6',
            price: 2250,
            desc: '2 Medium Pizzas\n1 Liter Drink',
            icons: ['🍕']
        },
        {
            name: 'Deal 7',
            price: 2850,
            desc: '2 Large Pizzas (Special)\n1 Liter Drink',
            icons: ['🍕']
        },
        {
            name: 'Deal 8',
            price: 3050,
            desc: '1 XL Pizza (Special)\n1 Plain Fries\n2 Zinger Burgers\n1.5 Liter Drink',
            icons: ['🔥']
        },
        {
            name: 'Deal 9',
            price: 4000,
            desc: '1 XL Pizza (Special)\n5 Zinger Burgers\n1.5 Liter Drink',
            icons: ['🔥']
        },
        {
            name: 'Deal 10',
            price: 4800,
            desc: '1 XL Pizza (Special)\n5 Zinger Burgers\n2 Plain Fries\n' +
                  '1.5 Liter Drink\n3 Chicken Shawarmas',
            icons: ['🔥']
        }
    ].map(deal => ({
        ...deal,
        original: null
    }));

    // ---------------------------------------------------------
    // VALIDATION AND CONFIRMATION
    // ---------------------------------------------------------

    if (menu.length !== 110 || deals.length !== 14) {
        console.error('Safety check failed. Nothing was imported.', {
            menuCount: menu.length,
            expectedMenuCount: 110,
            dealCount: deals.length,
            expectedDealCount: 14
        });
        alert('Safety check failed. Nothing was imported. Check the Console.');
        return;
    }

    const duplicateNames = list => {
        const seen = new Set();
        const duplicates = new Set();

        for (const item of list) {
            const key = item.name.trim().toLowerCase();
            if (seen.has(key)) duplicates.add(item.name);
            seen.add(key);
        }

        return [...duplicates];
    };

    const duplicateMenuNames = duplicateNames(menu);
    const duplicateDealNames = duplicateNames(deals);

    if (duplicateMenuNames.length || duplicateDealNames.length) {
        console.error('Duplicate names detected in importer data.', {
            duplicateMenuNames,
            duplicateDealNames
        });
        alert('Duplicate names were detected in the script data. Nothing was imported.');
        return;
    }

    const confirmed = window.confirm(
        'SANGAT CAFE BULK IMPORT\n\n' +
        `Menu entries to create: ${menu.length}\n` +
        `Deals to create: ${deals.length}\n` +
        `Total new entries: ${menu.length + deals.length}\n\n` +
        'This will send POST requests to the existing API.\n' +
        'Existing entries will not be deliberately deleted or updated.\n\n' +
        'IMPORTANT: Run only once. If the import stops part-way, do not run it again blindly.\n\n' +
        'Continue with the import?'
    );

    if (!confirmed) {
        console.log('Sangat Cafe import cancelled. No requests were sent.');
        return;
    }

    // Reserve this version before the first request to prevent accidental reruns.
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            startedAt: new Date().toISOString(),
            status: 'started'
        }));
    } catch (error) {
        alert('Browser storage is unavailable. Import cancelled to help prevent duplicates.');
        console.error(error);
        return;
    }

    window.__SANGAT_IMPORT_RUNNING__ = true;

    const report = {
        menu: { success: [], failed: [] },
        deals: { success: [], failed: [] },
        stoppedForAuthentication: false
    };

    async function sendItem(endpoint, item, type) {
        const url = `${BASE_URL}${endpoint}?restaurant=${encodeURIComponent(RESTAURANT_ID)}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(item)
            });

            const responseText = await response.text();
            let responseData = null;

            try {
                responseData = responseText ? JSON.parse(responseText) : null;
            } catch {
                // A non-JSON response will be reported below if it indicates an error.
            }

            if (
                response.status === 401 ||
                response.status === 403 ||
                response.redirected ||
                (responseData && responseData.error &&
                    /auth|login|unauthori[sz]ed|forbidden/i.test(responseData.error))
            ) {
                const error = new Error(
                    `Authentication/session problem (HTTP ${response.status}).`
                );
                error.authenticationFailure = true;
                throw error;
            }

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${responseText.slice(0, 250)}`
                );
            }

            if (
                responseData &&
                responseData.success === false
            ) {
                throw new Error(responseData.message || responseData.error || 'API rejected the item.');
            }

            if (
                responseData &&
                responseData.error
            ) {
                throw new Error(responseData.error);
            }

            report[type].success.push(item.name);
            console.log(`✓ ${type === 'menu' ? 'MENU' : 'DEAL'}: ${item.name}`);
            return true;
        } catch (error) {
            report[type].failed.push({
                name: item.name,
                reason: error.message || String(error)
            });

            console.error(`✗ ${type.toUpperCase()}: ${item.name}`, error);
            return error.authenticationFailure ? 'AUTH_FAILURE' : false;
        }
    }

    async function importList(items, endpoint, type) {
        for (let index = 0; index < items.length; index++) {
            const item = items[index];

            console.log(
                `[${index + 1}/${items.length}] Importing ${type}: ${item.name}`
            );

            const result = await sendItem(endpoint, item, type);

            if (result === 'AUTH_FAILURE') {
                report.stoppedForAuthentication = true;
                console.error(
                    'Import stopped because the admin session may have expired. ' +
                    'No automatic retries will be attempted.'
                );
                return false;
            }

            // No retries: continue to the next item after an individual failure.
        }

        return true;
    }

    try {
        console.log('Starting Sangat Cafe import.');
        console.log(`Menu entries: ${menu.length}; deals: ${deals.length}.`);

        const menuFinished = await importList(
            menu,
            '/api/menu',
            'menu'
        );

        if (menuFinished) {
            await importList(
                deals,
                '/api/deals',
                'deals'
            );
        } else {
            console.warn('Deals were not attempted because authentication failed during menu import.');
        }

        const status = {
            finishedAt: new Date().toISOString(),
            menuSuccess: report.menu.success.length,
            menuFailed: report.menu.failed.length,
            dealsSuccess: report.deals.success.length,
            dealsFailed: report.deals.failed.length,
            stoppedForAuthentication: report.stoppedForAuthentication,
            status: report.stoppedForAuthentication ? 'stopped-authentication' : 'finished'
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(status));

        console.log('\n========== SANGAT CAFE IMPORT REPORT ==========');
        console.log('Menu successful:', report.menu.success.length);
        console.log('Menu failed:', report.menu.failed.length);
        console.log('Deals successful:', report.deals.success.length);
        console.log('Deals failed:', report.deals.failed.length);
        console.log('Authentication stop:', report.stoppedForAuthentication);
        console.log('Successful menu items:', report.menu.success);
        console.log('Successful deals:', report.deals.success);
        console.log('Failed menu items:', report.menu.failed);
        console.log('Failed deals:', report.deals.failed);
        console.log('Full report:', report);
        console.log('==============================================');

        if (typeof window.loadAdminData === 'function') {
            try {
                await window.loadAdminData();
                console.log('Admin data refreshed using loadAdminData().');
            } catch (error) {
                console.warn('Import finished, but loadAdminData() could not refresh the page:', error);
            }
        } else {
            console.warn(
                'loadAdminData() is not available globally. Refresh the Admin page manually ' +
                'after checking the report.'
            );
        }

        alert(
            'SANGAT CAFE IMPORT REPORT\n\n' +
            `Menu successful: ${report.menu.success.length}\n` +
            `Menu failed: ${report.menu.failed.length}\n` +
            `Deals successful: ${report.deals.success.length}\n` +
            `Deals failed: ${report.deals.failed.length}\n\n` +
            (report.stoppedForAuthentication
                ? 'Import stopped because of an authentication problem. Check the Console.'
                : 'Import attempt finished. Check the Console for failed entries.')
        );
    } catch (error) {
        console.error('Unexpected importer error:', error);
        alert(
            'The import stopped unexpectedly. Check the browser Console before doing anything else. ' +
            'Do not rerun the importer blindly.'
        );
    } finally {
        window.__SANGAT_IMPORT_RUNNING__ = false;
    }
})();
