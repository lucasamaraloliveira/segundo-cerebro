const fs = require('fs');

async function testFetch() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const apiKeyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
  const apiKey = apiKeyMatch[1].trim();
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "hi" }] }]
    })
  });
  
  const data = await response.json();
  console.log("Fetch Status:", response.status);
  console.log("Fetch Data:", JSON.stringify(data, null, 2));
}
testFetch();
