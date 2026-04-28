const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
const Groq = require("groq-sdk");
const { CohereClient } = require("cohere-ai");
const Product = require('../models/Product');
const User = require('../models/User');
const socketIO = require('../sockets/socketHandler');
const notificationService = require('../services/notificationService');
const timeService = require('./timeService');

// Dynamic Getters for AI Clients (Ensures .env updates are always picked up)
const getGenAI = () => process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const getOpenAI = () => process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const getGroq = () => process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const getCohere = () => process.env.COHERE_API_KEY ? new CohereClient({ token: process.env.COHERE_API_KEY }) : null;


async function tryGemini(prompt) {
    const genAI = getGenAI();
    if (!genAI) throw new Error('Gemini API key not configured');
    
    let finalPrompt = "";
    if (typeof prompt === 'object' && prompt.system) {
        finalPrompt = `SYSTEM: ${prompt.system}\n\nUSER: ${prompt.user}`;
    } else {
        finalPrompt = prompt;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await Promise.race([
        model.generateContent(finalPrompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini Timeout')), 15000))
    ]);
    const response = await result.response;
    return response.text();
}


async function tryOpenAI(prompt, isJson) {
    const openai = getOpenAI();
    if (!openai) throw new Error('OpenAI API key not configured');
    
    const messages = [];
    if (typeof prompt === 'object' && prompt.system) {
        messages.push({ role: "system", content: prompt.system });
        messages.push({ role: "user", content: prompt.user });
    } else {
        messages.push({ role: "user", content: prompt });
    }

    const options = {
        model: "gpt-4o-mini",
        messages: messages
    };
    if (isJson) {
        options.response_format = { type: "json_object" };
    }
    const response = await Promise.race([
        openai.chat.completions.create(options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI Timeout')), 15000))
    ]);
    return response.choices[0].message.content;
}


async function tryGroq(prompt, isJson) {
    const groq = getGroq();
    if (!groq) throw new Error('Groq API key not configured');
    
    const messages = [];
    if (typeof prompt === 'object' && prompt.system) {
        messages.push({ role: "system", content: prompt.system });
        messages.push({ role: "user", content: prompt.user });
    } else {
        messages.push({ role: "user", content: prompt });
    }
    
    const options = {
        model: "llama-3.1-8b-instant",
        messages: messages
    };
    if (isJson) {
        options.response_format = { type: "json_object" };
    }
    const response = await Promise.race([
        groq.chat.completions.create(options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Groq Timeout')), 10000))
    ]);
    return response.choices[0].message.content;
}


async function tryCohere(prompt) {
    const cohere = getCohere();
    if (!cohere) throw new Error('Cohere API key not configured');
    
    let finalPrompt = "";
    if (typeof prompt === 'object' && prompt.system) {
        finalPrompt = `SYSTEM: ${prompt.system}\n\nUSER: ${prompt.user}`;
    } else {
        finalPrompt = prompt;
    }

    const response = await Promise.race([
        cohere.chat({
            model: "command-r",
            message: finalPrompt,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cohere Timeout')), 15000))
    ]);
    return response.text;
}


async function tryMock(prompt, isJson) {
    console.log('Using Mock AI Provider (No API keys found)...');
    
    if (isJson) {
        return JSON.stringify({
            riskLevel: "Low",
            failurePrediction: "The product appears to be in good health. This is a mock analysis for development purposes. This analysis is an estimate based on usage patterns and provided inputs.",
            maintenanceTips: [
                "Keep the device clean",
                "Ensure proper ventilation",
                "Configure real API keys for deep insights"
            ]
        });
    }

    if (typeof prompt === 'object' && prompt.system) {
        // Simple logic to provide a semi-relevant mock response
        const userMsg = prompt.user.toLowerCase();
        if (userMsg.includes('hello') || userMsg.includes('hi')) {
            return "Hello! I'm the LifeSync AI Assistant (Dev Mode). I see you haven't configured any API keys yet, so I'm here to help you test the interface! [SUGGESTIONS: How do I add keys? | What can you do? | Show me my inventory]";
        }
        return "I'm currently running in Development Mode because no API keys were found in your .env file. Once you add a Gemini or OpenAI key, I'll be able to give you deep product insights! [SUGGESTIONS: How to add API keys | Tell me about LifeSync | Check product health]";
    }
    return "This is a mock response for testing. Please add API keys to .env to enable real AI analysis.";
}


const callAIWithFallback = async (prompt, userId, productId = null, isJson = true) => {
    const providers = [
        { name: 'Gemini', fn: tryGemini },
        { name: 'Groq', fn: tryGroq },
        { name: 'OpenAI', fn: tryOpenAI },
        { name: 'Cohere', fn: tryCohere },
        { name: 'Mock Engine', fn: tryMock }
    ];

    let lastError = null;
    for (const provider of providers) {
        try {
            if (userId) {
                socketIO.notifyUser(userId, 'ai_status', { 
                    engine: provider.name, 
                    status: 'active',
                    message: `Connecting to ${provider.name}...`,
                    productId: productId
                });
            }

            console.log(`[AI] Attempting ${provider.name}...`);
            let responseText = await provider.fn(prompt, isJson);
            console.log(`[AI] ${provider.name} responded successfully!`);
            
            if (isJson) {
                // Robust JSON extraction
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('No valid JSON found in AI response');
                
                const json = JSON.parse(jsonMatch[0]);
                
                if (userId) {
                    socketIO.notifyUser(userId, 'ai_status', { 
                        engine: provider.name, 
                        status: 'success',
                        message: `${provider.name} analysis complete.`,
                        productId: productId
                    });
                }
                return { data: json, provider: provider.name };
            }

            if (userId) {
                socketIO.notifyUser(userId, 'ai_status', { 
                    engine: provider.name, 
                    status: 'success',
                    message: `${provider.name} responded.`,
                    productId: productId
                });
            }
            return { data: responseText, provider: provider.name };
        } catch (error) {
            console.error(`[AI] ${provider.name} Error:`, error.message);
            if (userId) {
                socketIO.notifyUser(userId, 'ai_status', { 
                    engine: provider.name, 
                    status: 'failed',
                    message: `${provider.name} failed. Trying next...`,
                    productId: productId
                });
            }
            lastError = error;
            continue; 
        }
    }
    throw new Error(`All global AI providers busy. Please try again.`);
};

/**
 * Generates immediate heuristic insights based on product stats
 * Used for instant UI feedback and as a fallback for expensive AI calls.
 */
const getHeuristicInsights = (product) => {
    const now = timeService.getCurrentTime();
    const purchaseDate = new Date(product.purchaseDate);
    const ageMonths = Math.max(0, (now - purchaseDate) / (1000 * 60 * 60 * 24 * 30.44));
    
    const usageRatio = product.dailyUsageHours / 24;
    const isWarrantyActive = ageMonths <= (product.warrantyMonths || 12);
    
    let risk = 'Low';
    let prediction = 'The product is functioning normally based on reported usage and age.';
    let tips = ['Perform routine cleaning', 'Avoid overloading', 'Ensure proper ventilation'];

    if (product.condition === 'moderate' || ageMonths > (product.warrantyMonths || 12) * 2) {
        risk = 'Medium';
        prediction = 'Normal wear and tear detected. Consider routine maintenance to maintain peak efficiency.';
        tips.push('Check for loose connections', 'Inspect filters or seals');
    }
    
    if (product.condition === 'poor' || product.healthScore < 20) {
        risk = 'High';
        prediction = 'Significant wear detected. We recommend a proactive professional inspection to prevent future downtime.';
        tips.push('Schedule professional service', 'Monitor for unusual sounds', 'Evaluate part longevity');
    }

    const confidenceMsg = "This analysis is an estimate based on usage patterns and provided inputs.";

    return {
        riskLevel: risk,
        failurePrediction: `${prediction} ${confidenceMsg}`,
        maintenanceTips: tips,
        lastUpdated: now,
        provider: 'Local Engine'
    };
};

exports.getHeuristicInsights = getHeuristicInsights;

exports.analyzeProduct = async (productId, useHeuristicOnly = false) => {
    try {
        const product = await Product.findById(productId);
        if (!product) return;

        // If we only want heuristic (for instant resets)
        if (useHeuristicOnly) {
            product.aiInsights = getHeuristicInsights(product);
            await product.save();
            socketIO.notifyUser(product.user, 'product_update', product);
            return;
        }

        const prompt = `
            As a specialized LifeSync Product Lifecycle Expert, perform a realistic diagnostic on this product.
            Use a calm, advisory, and non-exaggerated tone. Avoid alarmist language.
            
            Product Context:
            - Name: ${product.name}
            - Brand: ${product.brand}
            - Category: ${product.category}
            - Purchase Date: ${product.purchaseDate}
            - Warranty: ${product.warrantyMonths} months
            - Usage: ${product.dailyUsageHours} hours/day
            - Current Condition: ${product.condition}
            - Health Score: ${product.healthScore}%
            - Failure Probability: ${product.failureProbability}%
            - Lifecycle Stage: ${product.lifecycleStage}
            - Expected Lifespan: ${product.lifespan ? product.lifespan.message : '5-10 years'}

            Diagnostic Guidelines:
            1. If condition is "new" or "good" and product is functioning, increase trust and reduce risk level.
            2. If warranty is active, emphasize the protection it provides and reduce failure probability in your tone.
            3. Use the Expected Lifespan provided above to give a realistic assessment. Avoid exceeding it without justification.
            4. Tone: Advisory, balanced, and professional.
            5. MANDATORY: You MUST end the failurePrediction with this exact sentence: "This analysis is an estimate based on usage patterns and provided inputs."

            Required Output (JSON ONLY):
            {
                "riskLevel": "Low/Medium/High",
                "failurePrediction": "A professional, balanced 2-sentence summary. Sentence 1: Realistic assessment of current health. Sentence 2: Proactive advice for future monitoring. [MANDATORY CONFIDENCE MESSAGE]",
                "maintenanceTips": [
                    "Practical, specific tip 1",
                    "Practical, specific tip 2",
                    "Practical, specific tip 3"
                ]
            }

            Respond ONLY with the JSON object.
        `;

        const { data, provider } = await callAIWithFallback(prompt, product.user, productId);

        product.aiInsights = {
            riskLevel: data.riskLevel || 'Low',
            failurePrediction: data.failurePrediction || 'No immediate risk detected.',
            maintenanceTips: data.maintenanceTips || [],
            lastUpdated: timeService.getCurrentTime(),
            provider: provider
        };

        await product.save();
        socketIO.notifyUser(product.user, 'product_update', product);

        // Create notification for analysis completion
        await notificationService.createNotification({
            user: product.user,
            title: 'AI Analysis Complete',
            message: `Deep diagnostics for ${product.name} finished. Risk level: ${data.riskLevel}.`,
            type: data.riskLevel === 'High' ? 'danger' : data.riskLevel === 'Medium' ? 'warning' : 'success',
            category: 'health',
            productId: product.id
        });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        try {
            const product = await Product.findById(productId);
            if (product) {
                // Use the new extracted heuristic function
                product.aiInsights = getHeuristicInsights(product);
                product.aiInsights.failurePrediction += ' (Heuristic Fallback)';
                
                await product.save();
                socketIO.notifyUser(product.user, 'product_update', product);

                // Create notification for fallback analysis
                await notificationService.createNotification({
                    user: product.user,
                    title: 'Local Diagnostics Ready',
                    message: `Initial health check for ${product.name} is complete. Risk level: ${product.aiInsights.riskLevel}.`,
                    type: product.aiInsights.riskLevel === 'High' ? 'danger' : product.aiInsights.riskLevel === 'Medium' ? 'warning' : 'info',
                    category: 'health',
                    productId: product.id
                });
            }
        } catch (e) {
            console.error('Heuristic Fallback Error:', e);
        }
    }
};

exports.chatWithAI = async (userId, userMessage, productId, history = [], currentScreen = 'Dashboard') => {
    try {
        let userContext = "";
        let isGuest = !userId;

        if (!isGuest) {
            const user = await User.findById(userId);
            const allProducts = await Product.find({ user: userId });
            
            if (user) {
                userContext = `
                CURRENT USER STATUS:
                - Plan: ${user.plan.toUpperCase()}
                - Products Used: ${user.usage.products} / ${user.limits.products}
                - AI Insights Used: ${user.usage.aiRequests} / ${user.limits.aiRequests}
                - Storage Used: ${(user.usage.storage / (1024 * 1024)).toFixed(2)} MB / ${(user.limits.storage / (1024 * 1024)).toFixed(2)} MB
                `;
            }

            if (allProducts.length > 0) {
                const productSummary = allProducts.map(p => 
                    `- ${p.name}: Health ${p.healthScore}%, Risk ${p.aiInsights.riskLevel}`
                ).join('\n');
                fullContext = `User's Current Inventory:\n${productSummary}\n\n`;
            }
        } else {
            fullContext = "GUEST USER: User is exploring the landing page and is NOT logged in yet.";
        }

        // Format history for the prompt
        const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const systemPrompt = `STRICT ROLE & KNOWLEDGE:
        - You are the LifeSync AI Assistant, an expert in product lifecycle management and the LifeSync platform.
        - YOUR GOAL: Help users understand how LifeSync AI works and persuade them to sign up if they haven't already.

        ${userContext}

        - LANDING PAGE KNOWLEDGE BASE:
            * WHAT IS LIFESYNC: An AI-powered platform to track, manage, and extend the life of your physical products.
            * DASHBOARD: A premium interface to monitor total products, active warranties, and high-risk items. 
            * ADD PRODUCT: Advanced "AI Barcode Scan" that uses computer vision to identify products in seconds. Also supports manual entry.
            * ANALYTICS: Deep diagnostics using multi-engine AI, risk distribution charts, and predictive maintenance forecasts.
            * WARRANTY WALLET: A secure, encrypted digital vault for PDF/Image warranties, bills, and manuals.
            * NOTIFICATIONS: Proactive alerts for maintenance, security risks, and warranty expiry.
            * TIME SIMULATION: A unique developer tool allowing users to "warp" into the future to see how products will age.
            * AI CHAT: Cross-platform assistant (this chat) for troubleshooting and inventory insights.
            * AUTHENTICATION: Beautifully designed login/signup page with a dynamic "AI Molecule Physics" background.

        - PRICING & PLANS (STRICT KNOWLEDGE - NEVER HALLUCINATE):
            * NEVER mention 30-day trials, $9.99, or $19.99. These are WRONG.
            * ONLY use the following pricing in Indian Rupees (₹):
            * FREE PLAN: ₹0/mo. Includes 5 Products & 50 AI Insights.
            * PRO PLAN: ₹499/year. Includes 100 Products & 200 AI Insights.
            * PREMIUM PLAN: ₹999/year. Includes Unlimited Products & Unlimited AI.
            * BILLING: Paid plans are ONLY available as Yearly subscriptions. No monthly options.
            * VALUE PROPOSITION: All paid plans are billed yearly for maximum savings and uninterrupted protection.

        - GUEST ACCESS RULES (CRITICAL):
            * User is CURRENTLY A GUEST. They cannot see their own products yet.
            * If they ask about THEIR specific products, say: "As you are currently a guest, I cannot see your personal inventory. Please Login or Create an Account first so I can provide personalized insights for your products!"
            * For any question NOT related to LifeSync features or the landing page, politely state: "I am specialized in LifeSync platform details. For other queries, please join our community by signing up!"

        STRICT CONTEXT:
        - User's Current Screen: ${currentScreen}
        - User Status: ${isGuest ? 'Guest (Landing Page)' : 'Authenticated User'}
        - Inventory Context: ${fullContext}
        - Disclaimer (Mandatory for health/risk): Always include "This analysis is an estimate based on usage patterns and provided inputs."

        STRICT LANGUAGE RULES:
        1. DEFAULT LANGUAGE: Use English UNLESS requested otherwise.
        2. NATIVE SCRIPT: Respond in native script for regional languages.
        
        SUGGESTION CHIPS (MANDATORY):
        - Provide exactly 3 relevant follow-up questions at the end.
        - Mark with [SUGGESTIONS: question1 | question2 | question3]

        OUTPUT FORMAT:
        - Plain text ONLY. NO markdown or formatting.`;

        const userPrompt = `
            Inventory Context: ${fullContext}
            Conversation History: ${historyText}
            User Message: ${userMessage}
            Assistant Response:`;
        
        const { data, provider } = await callAIWithFallback({ system: systemPrompt, user: userPrompt }, userId, productId, false);
        const cleanText = data.replace(/\*\*/g, '').replace(/#/g, '');
        return { text: cleanText, provider: provider };
    } catch (error) {
        console.error('AI Chat Error:', error);
        return { text: "I'm having trouble connecting to all my AI engines. Please try again in a moment!", provider: 'Offline' };
    }
};

exports.getInventorySummary = async (userId) => {
    try {
        const products = await Product.find({ user: userId });
        if (products.length === 0) {
            return { text: "Your inventory is currently empty. Add products to get an AI-powered diagnostic summary." };
        }

        const productData = products.map(p => ({
            name: p.name,
            category: p.category,
            health: p.healthScore,
            risk: p.aiInsights.riskLevel,
            stage: p.lifecycleStage
        }));

        const prompt = `
            As a LifeSync Fleet Analyst, review the following product inventory and provide a concise, high-impact executive summary (3-4 sentences).
            Focus on overall health trends, specific categories at risk, and one actionable recommendation for the user.
            
            Inventory Data:
            ${JSON.stringify(productData)}

            Rules:
            1. Respond in plain text ONLY.
            2. Be direct and professional.
            3. Start with an overall assessment.
        `;

        const { data, provider } = await callAIWithFallback(prompt, userId, null, false);
        return { text: data, provider: provider };
    } catch (error) {
        console.error('Inventory Summary Error:', error);
        return { text: "Unable to generate a real-time summary at this time. Please review your diagnostics below." };
    }
};

/**
 * Identify product from a barcode image (Vision)
 */
/**
 * Identify product from a barcode image (Vision + Numeric Lookup)
 */
/**
 * Identify product from a barcode image (Vision + Numeric Lookup)
 */
exports.identifyProductFromImage = async (imageBuffer, mimeType, barcodeNumber = null) => {
    let resultData = null;
    let identificationSource = "ai_vision";
    let confidenceScore = 85;

    // 1. Try a public API first if we have a numeric barcode
    if (barcodeNumber) {
        try {
            const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeNumber}.json`);
            const offData = await offResponse.json();
            if (offData.status === 1 && offData.product) {
                const p = offData.product;
                return {
                    name: p.product_name || p.generic_name || `Product ${barcodeNumber}`,
                    brand: p.brands || "Generic",
                    category: "Grocery",
                    warrantyMonths: 6,
                    dailyUsageHours: 1,
                    condition: "new",
                    confidence: 98,
                    source: "barcode_api"
                };
            }
        } catch (apiError) { console.warn('Public API lookup failed:', apiError.message); }
    }

    // 2. Try Groq Llama 4 Scout Vision (Updated from decommissioned Llama 3.2)
    if (groq) {
        try {
            console.log('Attempting identification with Groq Llama 4 Scout Vision...');
            const prompt = `Identify this product. ${barcodeNumber ? `Barcode: ${barcodeNumber}` : ''} Return ONLY a JSON object with fields: name, brand, category (Electronics, Home Appliances, Grocery, Vehicles, Furniture, IT Equipment, Medical, Other), warrantyMonths, dailyUsageHours, condition, confidence, source: "ai_vision".`;
            
            const response = await groq.chat.completions.create({
                model: "llama-3.2-11b-vision-preview",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        ...(imageBuffer ? [{ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` } }] : [])
                    ]
                }],
                response_format: { type: "json_object" }
            });
            const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), source: "ai_vision" };
        } catch (groqError) { console.warn('Groq Vision failed:', groqError.message); }
    }

    // 3. Try Gemini Flash + Search (Using latest model string)
    if (genAI) {
        try {
            console.log('Attempting identification with Gemini Flash + Search...');
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", tools: [{ googleSearch: {} }] });
            const prompt = `Identify this product. ${barcodeNumber ? `Barcode: ${barcodeNumber}` : ''} Return JSON: name, brand, category, warrantyMonths, dailyUsageHours, condition, confidence, source: "ai_vision".`;
            const imagePart = imageBuffer ? { inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType } } : null;
            const result = await model.generateContent(imagePart ? [prompt, imagePart] : [prompt]);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), source: "ai_vision" };
        } catch (geminiError) { 
            console.warn('Gemini Search failed, trying without search:', geminiError.message);
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
                const prompt = `Identify this product. ${barcodeNumber ? `Barcode: ${barcodeNumber}` : ''} Return JSON: name, brand, category, warrantyMonths, dailyUsageHours, condition, confidence, source: "ai_vision".`;
                const imagePart = imageBuffer ? { inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType } } : null;
                const result = await model.generateContent(imagePart ? [prompt, imagePart] : [prompt]);
                const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
                if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), source: "ai_vision" };
            } catch (e) { console.error('Gemini total failure:', e.message); }
        }
    }

    // 4. Try OpenAI Vision (Handling Quota)
    if (openai) {
        try {
            console.log('Attempting identification with OpenAI...');
            const messages = [{
                role: "user",
                content: [{ type: "text", text: `Identify this product. ${barcodeNumber ? `Barcode: ${barcodeNumber}` : ''} Return JSON: name, brand, category, warrantyMonths, dailyUsageHours, condition, confidence, source: "ai_vision".` }]
            }];
            if (imageBuffer) {
                messages[0].content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` } });
            }
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" }
            });
            return { ...JSON.parse(response.choices[0].message.content), source: "ai_vision" };
        } catch (openaiError) {
            if (openaiError.status === 429) console.warn('OpenAI Quota Exceeded (429)');
            else console.warn('OpenAI failed:', openaiError.message);
        }
    }



    // 5. Ultimate Fallback
    return {
        name: barcodeNumber ? `Product ${barcodeNumber}` : "Unidentified Product",
        brand: "Unknown",
        category: "Other",
        warrantyMonths: 12,
        dailyUsageHours: 1,
        condition: "new",
        confidence: barcodeNumber ? 40 : 0,
        source: "manual"
    };


};

