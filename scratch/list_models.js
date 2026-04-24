const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function listModels() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const apiKeyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
  if (!apiKeyMatch) {
    console.error("API Key not found in .env.local");
    return;
  }
  const apiKey = apiKeyMatch[1].trim();
  
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).listModels();
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
     // If listModels is not on the model instance, try on genAI if it exists
     // Actually genAI doesn't have listModels directly in some versions
     console.log("Error listing models:", e.message);
  }
}

listModels();
