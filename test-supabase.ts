

const url = "https://ddtoevgmvlauhwpnuenc.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdG9ldmdtdmxhdWh3cG51ZW5jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0NDE1OSwiZXhwIjoyMDk0NTIwMTU5fQ.K7fF96emRUlNsRTH60hk6_rAGShws_g8xPZ2Hzil638";

async function test() {
  const response = await fetch(`${url}/rest/v1/loyalty_members?select=id,full_name,phone_number,email,stamp_count,rewards_redeemed,rewards_available,preferences,date_joined,created_at`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Body:", text);
}

test().catch(console.error);
