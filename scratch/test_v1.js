const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function test() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const apiKeyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
  const apiKey = apiKeyMatch[1].trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try v1 instead of v1beta
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' });
    const result = await model.generateContent("hi");
    console.log("v1 API Working:", result.response.text());
  } catch (e) {
    console.log("v1 Error:", e.message);
  }

  try {
    const embedModel = genAI.getGenerativeModel({ model: "embedding-001" }, { apiVersion: 'v1' });
    const result = await embedModel.embedContent("hi");
    console.log("v1 Embedding Working:", result.embedding.values.length);
  } catch (e) {
    console.log("v1 Embedding Error:", e.message);
  }
}
test();
