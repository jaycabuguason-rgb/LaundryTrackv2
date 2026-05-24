const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const SUPABASE_SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const NEXT_PUBLIC_SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];

async function restRequest(path, init) {
  const response = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init?.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function saveSupabaseSettings(key, value) {
  const updatedRows = await restRequest(
    `settings?key=eq.${encodeURIComponent(key)}&select=key,value`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({ value }),
    },
  );

  if (updatedRows && updatedRows[0] && updatedRows[0].value !== undefined) {
    return updatedRows[0].value;
  }

  const insertedRows = await restRequest(
    "settings?on_conflict=key&select=key,value",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          key,
          value,
        },
      ]),
    },
  );

  return insertedRows[0]?.value ?? value;
}

async function test() {
  try {
    const pricingConfig = { test: 1 };
    const serviceTypes = { test: 2 };

    const updates = [];
    if (pricingConfig) {
      updates.push(saveSupabaseSettings("pricing_config", pricingConfig));
    }
    if (serviceTypes) {
      updates.push(saveSupabaseSettings("service_types", serviceTypes));
    }

    await Promise.all(updates);
    console.log("Success");
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
