const { Client } = require('pg');
const fs = require('fs');

async function applyMigration() {
  const connectionString = "postgresql://postgres:NuRvMQ2BqVs7NE7b@db.ddtoevgmvlauhwpnuenc.supabase.co:5432/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to DB");

    const sql = fs.readFileSync('supabase/migrations/20260524_loyalty_email_stamp_history.sql', 'utf-8');
    await client.query(sql);
    console.log("Migration applied successfully!");

    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("PostgREST schema cache reloaded!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

applyMigration();
