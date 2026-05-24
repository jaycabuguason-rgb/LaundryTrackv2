const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

async function restRequest(path) {
  const response = await fetch(`${env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      apikey: env['SUPABASE_SERVICE_ROLE_KEY'],
      Authorization: `Bearer ${env['SUPABASE_SERVICE_ROLE_KEY']}`
    }
  });
  return response.json();
}
restRequest('settings?select=key,value').then(console.log);
