const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function test() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const apiKeyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
  const apiKey = apiKeyMatch[1].trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try to generate a simple content to see if API works
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent("hi");
  console.log("API Working:", result.response.text());
}
test();
