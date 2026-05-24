const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

async function testPut() {
  const response = await fetch('http://localhost:3000/api/settings/pricing', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pricingConfig: { test: 1, method: "PUT" },
      serviceTypes: [{ test: 2 }],
    })
  });
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Body:", text);
}
testPut();
