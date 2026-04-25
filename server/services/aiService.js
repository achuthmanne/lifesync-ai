const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
const Groq = require("groq-sdk");
const { CohereClient } = require("cohere-ai");
const Product = require('../models/Product');
const socketIO = require('../sockets/socketHandler');
const notificationService = require('../services/notificationService');
const timeService = require('./timeService');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const cohere = process.env.COHERE_API_KEY ? new CohereClient({ token: process.env.COHERE_API_KEY }) : null;


async function tryGemini(prompt) {
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
    if (!cohere) throw new Error('Cohere API key not configured');
    
    let finalPrompt = "";
    if (typeof prompt === 'object' && prompt.system) {
        finalPrompt = `SYSTEM: ${prompt.system}\n\nUSER: ${prompt.user}`;
    } else {
        finalPrompt = prompt;
    }

    const response = await Promise.race([
        cohere.chat({
            model: "command-r-plus",
            message: finalPrompt,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cohere Timeout')), 15000))
    ]);
    return response.text;
}


const callAIWithFallback = async (prompt, userId, productId = null, isJson = true) => {
    const providers = [
        { name: 'Gemini', fn: tryGemini },
        { name: 'Groq', fn: tryGroq },
        { name: 'OpenAI', fn: tryOpenAI },
        { name: 'Cohere', fn: tryCohere }
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

            console.log(`Attempting AI analysis with ${provider.name}...`);
            let responseText = await provider.fn(prompt, isJson);
            
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
            console.error(`${provider.name} failed:`, error.message);
            if (userId) {
                socketIO.notifyUser(userId, 'ai_status', { 
                    engine: provider.name, 
                    status: 'failed',
                    message: `${provider.name} busy. Switching...`,
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

exports.chatWithAI = async (userId, userMessage, productId, history = []) => {
    try {
        let fullContext = "";
        const allProducts = await Product.find({ user: userId });
        
        if (allProducts.length > 0) {
            const productSummary = allProducts.map(p => 
                `- ${p.name}: Health ${p.healthScore}%, Risk ${p.aiInsights.riskLevel}`
            ).join('\n');
            fullContext = `User's Current Inventory:\n${productSummary}\n\n`;
        }

        // Format history for the prompt
        const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const systemPrompt = `You are the LifeSync AI Assistant, a high-end expert in product lifecycle diagnostics and proactive maintenance.
        
        MISSION: We help users track product health (Electronics, Appliances, Vehicles, etc.) and provide realistic, balanced maintenance advice.
        
        KNOWLEDGE BASE:
        - Provide expert advice on appliance care and lifecycle extension using a calm, advisory, and non-exaggerated tone.
        - Avoid alarmist language. If a product is in good condition, reinforce user confidence.
        - Always include the following disclaimer when providing specific health predictions: "This analysis is an estimate based on usage patterns and provided inputs."

        STRICT LANGUAGE RULES:
        1. MIRROR USER: Respond in the EXACT same language as the user's latest message.
        2. NATIVE SCRIPT: Use NATIVE SCRIPT ONLY for regional languages (e.g., Devanagari for Hindi).
        
        OUTPUT FORMAT:
        - Plain text ONLY. NO markdown, stars (**), or hashtags (#).
        - AT THE VERY END, provide exactly 3 follow-up questions.
        - YOU MUST USE THIS EXACT FORMAT: [SUGGESTIONS: Question 1 | Question 2 | Question 3]`;

        const userPrompt = `
            Inventory Context: ${fullContext}
            Conversation History: ${historyText}

            User Message: ${userMessage}
            
            Assistant (Expert Diagnostic Response):`;
        
        const { data, provider } = await callAIWithFallback({ system: systemPrompt, user: userPrompt }, userId, productId, false);
        
        // Clean text and handle suggestions
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

