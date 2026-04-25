require('dotenv').config();
const aiService = require('./server/services/aiService');

async function test() {
    console.log("Testing AI Chat for INSTANT results...");
    const start = Date.now();
    try {
        const response = await aiService.chatWithAI('user123', 'Summarize your goal in 5 words.', null);
        const end = Date.now();
        console.log("Response:", response);
        console.log(`Time taken: ${end - start}ms`);
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
