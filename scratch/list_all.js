const fs = require('fs');

async function listAll() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const apiKeyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
  const apiKey = apiKeyMatch[1].trim();
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Models:", JSON.stringify(data, null, 2));
}
listAll();
