import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
];

for (const envName of REQUIRED_ENV_VARS) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptEntries = await readdir(__dirname, { withFileTypes: true });
const migrationFiles = scriptEntries
  .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

const databaseUrl = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const adminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME ?? adminEmail.split("@")[0];
const adminFullName = process.env.BOOTSTRAP_ADMIN_NAME ?? adminUsername;

const database = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

console.log("Connecting to Supabase Postgres...");
await database.connect();

try {
  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(__dirname, migrationFile);
    const migrationSql = await readFile(migrationPath, "utf8");
    console.log(`Applying schema from scripts/${migrationFile}...`);
    await database.query(migrationSql);
  }
  console.log("Schema applied successfully.");
} finally {
  await database.end();
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log(`Ensuring admin user exists for ${adminEmail}...`);

let existingUser = null;
let page = 1;

while (!existingUser) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page,
    perPage: 200,
  });

  if (error) {
    throw new Error(`Unable to list Supabase users: ${error.message}`);
  }

  existingUser = data.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase()) ?? null;

  if (existingUser || data.users.length < 200) {
    break;
  }

  page += 1;
}

let adminUserId = existingUser?.id ?? null;

if (!existingUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: adminFullName,
      role: "admin",
      username: adminUsername,
      is_active: true,
    },
  });

  if (error || !data.user) {
    throw new Error(`Unable to create admin user: ${error?.message ?? "unknown error"}`);
  }

  adminUserId = data.user.id;
  console.log("Admin user created.");
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      ...existingUser.user_metadata,
      full_name: adminFullName,
      role: "admin",
      username: adminUsername,
      is_active: true,
    },
  });

  if (error || !data.user) {
    throw new Error(`Unable to update admin user: ${error?.message ?? "unknown error"}`);
  }

  adminUserId = data.user.id;
  console.log("Admin user already existed, so the password and metadata were refreshed.");
}

const profileDatabase = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

await profileDatabase.connect();

try {
  await profileDatabase.query(
    `
      insert into public.profiles (id, full_name, username, role, is_active)
      values ($1, $2, $3, 'admin', true)
      on conflict (id) do update
      set
        full_name = excluded.full_name,
        username = excluded.username,
        role = 'admin',
        is_active = true,
        updated_at = now()
    `,
    [adminUserId, adminFullName, adminUsername],
  );
} finally {
  await profileDatabase.end();
}

console.log("Admin profile ensured in public.profiles.");
console.log("Bootstrap completed successfully.");
