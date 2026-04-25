const Product = require('../models/Product');
const notificationService = require('./notificationService');
const aiService = require('./aiService');
const socketIO = require('../sockets/socketHandler');
const cron = require('node-cron');
const timeService = require('./timeService');

/**
 * Real-Time Monitoring Service
 * Handles dynamic health calculations, lifecycle transitions, and background re-analysis.
 */

/**
 * Enhanced Lifespan Estimation Logic
 * Dynamically predicts lifespan based on category, keywords, usage, and condition.
 */
const calculateLifespan = (product) => {
    const name = (product.name || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    
    // Default Base Lifespan
    let baseMin = 5;
    let baseMax = 10;
    
    // 1. Known Category Base
    if (category.includes('electronics') || category.includes('it equipment')) {
        baseMin = 5; baseMax = 8;
    } else if (category.includes('appliances')) {
        baseMin = 8; baseMax = 12;
    } else if (category.includes('vehicles')) {
        baseMin = 10; baseMax = 15;
    } else if (category.includes('furniture')) {
        baseMin = 10; baseMax = 20;
    }
    
    // 2. Keyword Intelligence (Detect type from name if category is generic)
    const electronicsKeywords = ['laptop', 'phone', 'tablet', 'pc', 'monitor', 'tv', 'camera', 'watch', 'headphone', 'speaker'];
    const applianceKeywords = ['fridge', 'refrigerator', 'washer', 'dryer', 'microwave', 'oven', 'ac', 'conditioner', 'heater', 'vacuum'];
    const vehicleKeywords = ['bike', 'car', 'tractor', 'truck', 'scooter', 'motorcycle'];
    const furnitureKeywords = ['chair', 'table', 'sofa', 'bed', 'desk', 'wardrobe'];
    
    if (electronicsKeywords.some(kw => name.includes(kw))) {
        baseMin = 5; baseMax = 8;
    } else if (applianceKeywords.some(kw => name.includes(kw))) {
        baseMin = 8; baseMax = 12;
    } else if (vehicleKeywords.some(kw => name.includes(kw))) {
        baseMin = 10; baseMax = 15;
    } else if (furnitureKeywords.some(kw => name.includes(kw))) {
        baseMin = 10; baseMax = 20;
    }
    
    // 3. Adjustment Factors
    let adjustment = 1.0;
    
    // Usage Adjustment: Low increases life, high reduces it
    if (product.dailyUsageHours < 3) {
        adjustment += 0.15;
    } else if (product.dailyUsageHours > 8) {
        adjustment -= 0.20;
    }
    
    // Condition Adjustment
    if (product.condition === 'new') adjustment += 0.15;
    else if (product.condition === 'moderate') adjustment -= 0.10;
    else if (product.condition === 'poor') adjustment -= 0.25;
    
    let finalMin = baseMin * adjustment;
    let finalMax = baseMax * adjustment;
    
    // Rule: Never generate unrealistic long lifespans for tech (e.g. 20+ years for electronics)
    if (baseMax <= 8 && finalMax > 12) finalMax = 12;
    
    // Clamp to realistic minimums
    finalMin = Math.max(1, finalMin);
    finalMax = Math.max(2, finalMax);
    
    const avgLife = (finalMin + finalMax) / 2;
    const purchaseDate = new Date(product.purchaseDate);
    const endOfLifeYear = purchaseDate.getFullYear() + Math.round(avgLife);
    
    return {
        range: `${Math.floor(finalMin)}–${Math.ceil(finalMax)} years`,
        endOfLifeYear: endOfLifeYear,
        message: `This product is expected to last approximately ${Math.floor(finalMin)}–${Math.ceil(finalMax)} years under normal usage.`
    };
};

/**
 * Calculate dynamic stats based on real-time monitoring logic
 * Refined for realism: Balanced health scoring, gradual degradation, and warranty-aware risk.
 */
const calculateDynamicStats = (product) => {
    const now = timeService.getCurrentTime();
    const purchaseDate = new Date(product.purchaseDate);
    
    // Calculate Age in Months (Float for high precision monitoring)
    const ageMonths = Math.max(0, (now - purchaseDate) / (1000 * 60 * 60 * 24 * 30.44));
    const ageYears = ageMonths / 12;
    const isWarrantyActive = ageMonths <= (product.warrantyMonths || 12);
    
    // 1. Health Score Calculation (Realistic Rules)
    const baseHealthMap = {
        'new': 92,      // Range: 80–95%
        'good': 78,     // Range: 65–85%
        'moderate': 60, // Range: 50–70%
        'poor': 42      // Range: 30–55%
    };
    
    let healthScore = baseHealthMap[product.condition] || 70;

    // Gradual Age Impact: -0.15% per month (~1.8% per year)
    const ageImpact = ageMonths * 0.15;
    
    // Usage Impact: Scaled based on usage tier
    let usageMultiplier = 0.05; // Low usage
    if (product.dailyUsageHours > 8) usageMultiplier = 0.2; // High usage
    else if (product.dailyUsageHours > 3) usageMultiplier = 0.1; // Medium usage
    
    const usageImpact = ageMonths * (product.dailyUsageHours / 24) * usageMultiplier;
    
    healthScore -= (ageImpact + usageImpact);

    // Warranty Bonus: Reduce perceived risk if still covered
    if (isWarrantyActive) {
        healthScore += 5; 
    }

    // STRICT RULES: 
    // 1. Never drop below 40% if condition is "good"
    if (product.condition === 'good' && healthScore < 40) healthScore = 40;
    // 2. Never return 0% unless condition is poor and it's heavily aged
    if (healthScore < 5 && (product.condition !== 'poor' || ageYears < 5)) healthScore = 5;
    
    healthScore = Math.max(1, Math.min(100, Math.round(healthScore)));

    // 2. Lifecycle Transition Logic (Age-Based + Condition Check)
    // New (<1y) -> Active (1-3y) -> Maintenance (3-5y) -> Critical (5y+ if poor)
    let lifecycleStage = 'New';
    if (ageYears < 1) {
        lifecycleStage = 'New';
    } else if (ageYears < 3) {
        lifecycleStage = 'Active';
    } else if (ageYears < 5) {
        lifecycleStage = 'Maintenance';
    } else {
        // Critical only if condition is poor after 5 years
        if (product.condition === 'poor') {
            lifecycleStage = 'Critical';
        } else {
            lifecycleStage = 'Maintenance';
        }
    }

    // End-of-life: ONLY if health is critically low and condition is poor
    if (healthScore <= 5 && product.condition === 'poor') {
        lifecycleStage = 'End-of-life';
    }

    // 3. Failure Probability Engine (Range-Bound)
    let failureProbability = 30; // Base "Working"
    
    if (product.condition === 'new' || product.condition === 'good') {
        // Range: 20–50%
        failureProbability = 20 + (ageYears * 4);
        if (failureProbability > 50) failureProbability = 50;
    } else if (product.condition === 'moderate') {
        // Range: 40–70%
        failureProbability = 40 + (ageYears * 5);
        if (failureProbability > 70) failureProbability = 70;
    } else if (product.condition === 'poor') {
        // Range: 60–85%
        failureProbability = 60 + (ageYears * 4);
        if (failureProbability > 85) failureProbability = 85;
    }

    // Warranty reductions
    if (isWarrantyActive) {
        failureProbability -= 10;
    }

    // Absolute Limits
    if (lifecycleStage === 'End-of-life') {
        failureProbability = 100;
    } else {
        // NEVER output 100% unless end-of-life
        if (failureProbability >= 100) failureProbability = 98;
    }

    failureProbability = Math.max(15, Math.min(100, Math.round(failureProbability)));

    // 4. Enhanced Lifespan Estimation
    const lifespan = calculateLifespan(product);

    return {
        healthScore,
        lifecycleStage,
        failureProbability,
        lifespan
    };
};

/**
 * Enriches product data with real-time calculated values
 */
const enrichProductData = (product) => {
    const stats = calculateDynamicStats(product);
    
    // Create an enriched object for the response
    const enriched = product.toObject ? product.toObject() : { ...product };
    enriched.healthScore = stats.healthScore;
    enriched.lifecycleStage = stats.lifecycleStage;
    enriched.failureProbability = stats.failureProbability;
    enriched.lifespan = stats.lifespan;
    
    return enriched;
};

/**
 * Checks for critical thresholds and generates notifications
 */
const checkAndNotify = async (product, oldStats, newStats) => {
    const userId = product.user.toString();
    
    // 1. Health Threshold Alerts
    if (oldStats.healthScore >= 50 && newStats.healthScore < 50) {
        await notificationService.createNotification({
            user: userId,
            title: 'Critical Health Warning',
            message: `The health of your ${product.name} has dropped significantly to ${newStats.healthScore}%. Immediate maintenance recommended.`,
            type: 'danger',
            category: 'health',
            productId: product._id
        });
    }

    // 2. Lifecycle Stage Transition Alerts
    // Alert: Entered Maintenance
    if (oldStats.lifecycleStage !== 'Maintenance' && newStats.lifecycleStage === 'Maintenance') {
        await notificationService.createNotification({
            user: userId,
            title: 'Maintenance Phase Started',
            message: `${product.name} has entered the Maintenance phase. It's time for a routine check-up to extend its life.`,
            type: 'warning',
            category: 'maintenance',
            productId: product._id
        });
    }

    // Alert: Entered Critical
    if (oldStats.lifecycleStage !== 'Critical' && newStats.lifecycleStage === 'Critical') {
        await notificationService.createNotification({
            user: userId,
            title: 'Critical Lifecycle Alert',
            message: `${product.name} has entered the Critical lifecycle stage. High risk of failure detected.`,
            type: 'danger',
            category: 'maintenance',
            productId: product._id
        });
    }

    // Alert: Entered End-of-life
    if (oldStats.lifecycleStage !== 'End-of-life' && newStats.lifecycleStage === 'End-of-life') {
        await notificationService.createNotification({
            user: userId,
            title: 'End-of-Life Alert',
            message: `${product.name} has reached the end of its projected lifecycle. We recommend planning for a replacement soon.`,
            type: 'danger',
            category: 'maintenance',
            productId: product._id
        });
    }

    // 3. Predictive Failure Probability Alerts
    if (oldStats.failureProbability < 80 && newStats.failureProbability >= 80) {
        await notificationService.createNotification({
            user: userId,
            title: 'Predictive Failure Alert',
            message: `LifeSync AI predicts an 80%+ probability of failure for ${product.name} based on current usage.`,
            type: 'danger',
            category: 'maintenance',
            productId: product._id
        });
    }

    // 4. Warranty Expiry Alerts (Dynamic calculation)
    const nowTime = timeService.getCurrentTime();
    const purchaseDate = new Date(product.purchaseDate);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setMonth(expiryDate.getMonth() + (product.warrantyMonths || 12));
    
    const diffDays = Math.ceil((expiryDate - nowTime) / (1000 * 60 * 60 * 24));

    // Threshold alerts for warranty
    if (diffDays === 30) {
        await notificationService.createNotification({
            user: userId,
            title: 'Warranty Expiring Soon',
            message: `The warranty for your ${product.name} will expire in 30 days. Consider a maintenance check-up soon.`,
            type: 'warning',
            category: 'warranty',
            productId: product._id
        });
    } else if (diffDays === 7) {
        await notificationService.createNotification({
            user: userId,
            title: 'Warranty Expiry Alert',
            message: `Your ${product.name} warranty expires in 1 week. This is your last chance for free coverage on identified issues.`,
            type: 'danger',
            category: 'warranty',
            productId: product._id
        });
    } else if (diffDays === 0) {
        await notificationService.createNotification({
            user: userId,
            title: 'Warranty Expired',
            message: `The warranty for ${product.name} has expired today. Standard repair costs will now apply.`,
            type: 'danger',
            category: 'warranty',
            productId: product._id
        });
    }
};

/**
 * Background Monitoring Job
 * Performs bulk updates and AI re-analysis
 */
const runMonitoringSync = async (forceAI = false) => {
    console.log(`[Monitoring Engine] Starting ${forceAI ? 'Full' : 'Lightweight'} Sync...`);
    try {
        const products = await Product.find({});
        let updateCount = 0;
        
        for (const product of products) {
            const oldStats = {
                healthScore: product.healthScore,
                lifecycleStage: product.lifecycleStage,
                failureProbability: product.failureProbability || 0
            };
            
            const newStats = calculateDynamicStats(product);
            
            // Time Travel Detection: If current time is earlier than last AI update, 
            // it means the simulation was reset.
            const lastAIUpdate = product.aiInsights.lastUpdated || 0;
            const isTimeTravelBack = timeService.getCurrentTime() < lastAIUpdate;
            
            // Check if state has changed significantly
            const hasChanged = oldStats.healthScore !== newStats.healthScore || 
                             oldStats.lifecycleStage !== newStats.lifecycleStage ||
                             oldStats.failureProbability !== newStats.failureProbability ||
                             isTimeTravelBack;

            if (hasChanged || forceAI) {
                // Update persistent storage (last known state)
                product.healthScore = newStats.healthScore;
                product.lifecycleStage = newStats.lifecycleStage;
                product.failureProbability = newStats.failureProbability;
                
                // If resetting or time traveling back, apply heuristic IMMEDIATELY
                // to make the UI feel responsive and "normal" right away.
                if (isTimeTravelBack) {
                    product.aiInsights = aiService.getHeuristicInsights(product);
                }

                await product.save();
                updateCount++;

                // Trigger intelligent notifications
                await checkAndNotify(product, oldStats, newStats);

                // Re-analyze via AI if needed (every 24h or if forced or if reset)
                const hoursSinceAI = (timeService.getCurrentTime() - lastAIUpdate) / (1000 * 60 * 60);
                
                if (forceAI || isTimeTravelBack || hoursSinceAI >= 24) {
                    // This runs in background, don't await to avoid blocking loop
                    // If it was a reset, we might want to just stick with heuristic for a bit 
                    // or trigger a full AI re-analysis.
                    aiService.analyzeProduct(product._id).catch(e => console.error(`AI Analysis failed for ${product.name}:`, e));
                }

                // Broadcast live update to UI via WebSockets
                socketIO.notifyUser(product.user, 'product_update', enrichProductData(product));
            }
        }
        
        console.log(`[Monitoring Engine] Sync complete. Updated ${updateCount} products.`);
    } catch (err) {
        console.error('[Monitoring Engine] Sync failed:', err);
    }
};

/**
 * Initialize Monitoring Engine and Schedules
 */
exports.init = () => {
    // 1. Daily Full AI Re-analysis (at 00:00)
    cron.schedule('0 0 * * *', () => {
        runMonitoringSync(true);
    });
    
    // 2. Hourly Lightweight Health/Lifecycle Sync
    cron.schedule('0 * * * *', () => {
        runMonitoringSync(false);
    });

    // 3. Initial Sync on startup
    setTimeout(() => runMonitoringSync(false), 5000);

    console.log('[Monitoring Engine] Real-time monitoring initialized.');
};

exports.calculateDynamicStats = calculateDynamicStats;
exports.enrichProductData = enrichProductData;
exports.runMonitoringSync = runMonitoringSync;
