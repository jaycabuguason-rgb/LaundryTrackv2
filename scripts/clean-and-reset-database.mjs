import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const envName of REQUIRED_ENV_VARS) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NEW_ADMIN_EMAIL = process.env.NEW_ADMIN_EMAIL || "admin@gmail.com";
const NEW_ADMIN_PASSWORD = process.env.NEW_ADMIN_PASSWORD || "admin123";
const NEW_ADMIN_USERNAME = process.env.NEW_ADMIN_USERNAME || "admin";
const NEW_ADMIN_NAME = process.env.NEW_ADMIN_NAME || "Admin";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createBackup() {
  console.log("===> [1/6] Creating pre-reset safety backup...");
  try {
    const [settingsRes, serviceTypesRes, addOnsRes, membersRes, transactionsRes] = await Promise.all([
      supabase.from("settings").select("*"),
      supabase.from("service_types").select("*"),
      supabase.from("add_ons").select("*"),
      supabase.from("loyalty_members").select("*"),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      counts: {
        settings: settingsRes.data?.length ?? 0,
        service_types: serviceTypesRes.data?.length ?? 0,
        add_ons: addOnsRes.data?.length ?? 0,
        loyalty_members: membersRes.data?.length ?? 0,
        transactions: transactionsRes.data?.length ?? 0,
      },
      data: {
        settings: settingsRes.data ?? [],
        service_types: serviceTypesRes.data ?? [],
        add_ons: addOnsRes.data ?? [],
        loyalty_members: membersRes.data ?? [],
        transactions: transactionsRes.data ?? [],
      },
    };

    const backupDir = path.join(__dirname, "..", "backups");
    await fs.mkdir(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `backup_prereset_${Date.now()}.json`);
    await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), "utf8");
    console.log(`Safety backup saved to: ${backupFile}`);
  } catch (err) {
    console.warn("Notice: Pre-reset backup step encountered an issue (continuing):", err.message);
  }
}

async function deleteInBatches(tableName, idCol = "id", batchSize = 200) {
  while (true) {
    const { data, error } = await supabase.from(tableName).select(idCol).limit(batchSize);
    if (error) {
      throw new Error(`Failed to query IDs from ${tableName}: ${error.message}`);
    }
    if (!data || data.length === 0) {
      break;
    }
    const ids = data.map((row) => row[idCol]);
    const { error: delError } = await supabase.from(tableName).delete().in(idCol, ids);
    if (delError) {
      throw new Error(`Failed to delete batch from ${tableName}: ${delError.message}`);
    }
    process.stdout.write(`.`);
  }
  console.log(` Cleared ${tableName}.`);
}

async function wipeDatabaseRecords() {
  console.log("===> [2/6] Deleting operational and transactional tables...");

  // Delete leaf tables first
  process.stdout.write("Deleting audit_logs ");
  await deleteInBatches("audit_logs");

  process.stdout.write("Deleting notifications ");
  await deleteInBatches("notifications");

  process.stdout.write("Deleting reward_history ");
  await deleteInBatches("reward_history");

  process.stdout.write("Deleting stamp_history ");
  await deleteInBatches("stamp_history");

  process.stdout.write("Deleting transactions ");
  await deleteInBatches("transactions");

  process.stdout.write("Deleting loyalty_members ");
  await deleteInBatches("loyalty_members");

  console.log("===> [3/6] Resetting service types, add-ons, and settings to defaults...");

  // Service types
  process.stdout.write("Resetting service_types ");
  await deleteInBatches("service_types");
  const { error: stError } = await supabase.from("service_types").insert([
    { name: "Regular", description: "Standard wash and dry", price: 30, pricing_type: "per-kg", is_active: true, show_price: true },
    { name: "Delicate", description: "Gentle cycle for delicate fabrics", price: 40, pricing_type: "per-kg", is_active: true, show_price: true },
    { name: "Express", description: "Same-day turnaround", price: 50, pricing_type: "per-kg", is_active: true, show_price: true },
    { name: "Bulk / Commercial", description: "For 10kg and above", price: 250, pricing_type: "per-load", is_active: false, show_price: true },
  ]);
  if (stError) throw new Error(`Failed to seed service_types: ${stError.message}`);
  console.log("Reseeded default service_types.");

  // Add-ons
  process.stdout.write("Resetting add_ons ");
  await deleteInBatches("add_ons");
  const { error: aoError } = await supabase.from("add_ons").insert([
    { name: "Fabcon", rate: 10, is_active: true },
    { name: "Express (+50%)", rate: 50, is_active: true },
    { name: "Bleach", rate: 15, is_active: true },
    { name: "Starch", rate: 20, is_active: true },
  ]);
  if (aoError) throw new Error(`Failed to seed add_ons: ${aoError.message}`);
  console.log("Reseeded default add_ons.");

  // Settings
  process.stdout.write("Resetting settings ");
  await deleteInBatches("settings");
  const { error: setErr } = await supabase.from("settings").insert([
    {
      key: "pricing",
      value: {
        pricePerKg: "30",
        minWeight: "",
        pricingMode: "per-kg",
        loadTiers: [
          { id: "1", name: "Small Load", range: "below 4 kg", price: "80" },
          { id: "2", name: "Medium Load", range: "4 kg - 7 kg", price: "120" },
          { id: "3", name: "Large Load", range: "7 kg - 10 kg", price: "180" },
          { id: "4", name: "Bulk / Commercial", range: "10 kg+", price: "250" },
        ],
        priceDisplayMode: "show",
      },
    },
    {
      key: "loyalty",
      value: {
        enabled: true,
        washesPerReward: "10",
        rewardDescription: "Free wash",
      },
    },
    {
      key: "business_profile",
      value: {
        shopName: "Sunshine Laundry Shop",
        tagline: "Powered by LaundryTrack",
        address: "123 Magsaysay Ave, Brgy. Sta. Cruz, Manila",
        contactNumber: "(02) 8123-4567",
        email: NEW_ADMIN_EMAIL,
        logoDataUrl: "",
        receiptFooter: "Thank you for choosing Sunshine Laundry Shop!",
        pickupInstructions: "Present this receipt or QR code upon claiming.",
      },
    },
  ]);
  if (setErr) throw new Error(`Failed to seed settings: ${setErr.message}`);
  console.log("Reseeded default settings.");
}

async function resetUsersAndAdmin() {
  console.log("===> [4/6] Cleaning staff accounts & setting new Admin credentials...");

  // 1. Fetch all profiles
  const { data: profiles, error: profError } = await supabase.from("profiles").select("*");
  if (profError) throw new Error(`Failed to fetch profiles: ${profError.message}`);

  const staffProfiles = profiles.filter((p) => p.role === "staff");
  const adminProfiles = profiles.filter((p) => p.role === "admin");

  // 2. Delete staff accounts
  console.log(`Found ${staffProfiles.length} staff member(s) to remove.`);
  for (const staff of staffProfiles) {
    console.log(`- Removing staff: ${staff.email || staff.username || staff.id}`);
    await supabase.auth.admin.deleteUser(staff.id).catch((e) => console.warn(`Auth delete warning: ${e.message}`));
    await supabase.from("profiles").delete().eq("id", staff.id);
  }

  // 3. Find or create Admin
  let adminUserId = null;
  if (adminProfiles.length > 0) {
    adminUserId = adminProfiles[0].id;
    console.log(`Found existing admin account (ID: ${adminUserId})`);

    // Update in Supabase Auth
    const { data: updatedAuth, error: authUpdateError } = await supabase.auth.admin.updateUserById(adminUserId, {
      email: NEW_ADMIN_EMAIL,
      password: NEW_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        username: NEW_ADMIN_USERNAME,
        full_name: NEW_ADMIN_NAME,
        is_active: true,
      },
    });

    if (authUpdateError) {
      throw new Error(`Failed to update admin in Auth: ${authUpdateError.message}`);
    }

    console.log(`Updated admin auth credentials (Email: ${NEW_ADMIN_EMAIL})`);

    // Update in profiles table
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        email: NEW_ADMIN_EMAIL,
        username: NEW_ADMIN_USERNAME,
        full_name: NEW_ADMIN_NAME,
        phone_number: null,
        avatar_url: null,
        role: "admin",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminUserId);

    if (profileUpdateError) {
      throw new Error(`Failed to update admin profile: ${profileUpdateError.message}`);
    }

    console.log(`Updated admin profile in public.profiles (Username: ${NEW_ADMIN_USERNAME})`);
  } else {
    // If no admin profile exists, create new
    console.log(`No existing admin profile found. Creating new admin user: ${NEW_ADMIN_EMAIL}`);
    const { data: newAuth, error: newAuthError } = await supabase.auth.admin.createUser({
      email: NEW_ADMIN_EMAIL,
      password: NEW_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        username: NEW_ADMIN_USERNAME,
        full_name: NEW_ADMIN_NAME,
        is_active: true,
      },
    });

    if (newAuthError) {
      throw new Error(`Failed to create admin in Auth: ${newAuthError.message}`);
    }

    adminUserId = newAuth.user.id;
    const { error: insertProfError } = await supabase.from("profiles").upsert({
      id: adminUserId,
      email: NEW_ADMIN_EMAIL,
      username: NEW_ADMIN_USERNAME,
      full_name: NEW_ADMIN_NAME,
      role: "admin",
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (insertProfError) {
      throw new Error(`Failed to insert admin profile: ${insertProfError.message}`);
    }
    console.log(`Created new admin profile (ID: ${adminUserId})`);
  }

  // Double check if any orphaned staff remain in auth.users
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (userList?.users) {
    for (const u of userList.users) {
      if (u.id !== adminUserId && (u.user_metadata?.role === "staff" || u.email !== NEW_ADMIN_EMAIL)) {
        console.log(`Cleaning leftover auth user: ${u.email || u.id}`);
        await supabase.auth.admin.deleteUser(u.id).catch(() => {});
      }
    }
  }
}

async function purgeAvatarStorage() {
  console.log("===> [5/6] Purging avatars in storage bucket...");
  try {
    const { data: files, error: listError } = await supabase.storage.from("avatars").list();
    if (!listError && files && files.length > 0) {
      const pathsToDelete = files.map((f) => f.name).filter((name) => name !== ".emptyFolderPlaceholder");
      if (pathsToDelete.length > 0) {
        const { error: removeError } = await supabase.storage.from("avatars").remove(pathsToDelete);
        if (removeError) {
          console.warn("Storage deletion warning:", removeError.message);
        } else {
          console.log(`Removed ${pathsToDelete.length} avatar file(s).`);
        }
      } else {
        console.log("No avatar files to delete.");
      }
    } else {
      console.log("No avatars found in storage bucket.");
    }
  } catch (err) {
    console.warn("Storage cleanup notice (non-fatal):", err.message);
  }
}

async function printVerificationSummary() {
  console.log("\n===> [6/6] Final verification of all tables...");
  const tables = [
    "transactions",
    "loyalty_members",
    "stamp_history",
    "reward_history",
    "audit_logs",
    "notifications",
    "service_types",
    "add_ons",
    "settings",
    "profiles",
  ];

  console.log("\n================ RECORD COUNTS ================");
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`- ${table.padEnd(20)} : Error (${error.message})`);
    } else {
      console.log(`- ${table.padEnd(20)} : ${count} rows`);
    }
  }

  const { data: adminProfiles } = await supabase.from("profiles").select("id, email, username, full_name, role, is_active");
  console.log("\n================ CURRENT PROFILES ================");
  console.table(adminProfiles);
  console.log("==================================================\n");
}

async function main() {
  console.log("==================================================================");
  console.log(" LaundryTrack: Database Reset & Admin Account Setup");
  console.log(" Target Admin Email:    ", NEW_ADMIN_EMAIL);
  console.log(" Target Admin Username: ", NEW_ADMIN_USERNAME);
  console.log(" Target Admin Password: ", NEW_ADMIN_PASSWORD);
  console.log("==================================================================\n");

  await createBackup();
  await wipeDatabaseRecords();
  await resetUsersAndAdmin();
  await purgeAvatarStorage();
  await printVerificationSummary();

  console.log("All records wiped and new admin account set up successfully!");
}

main().catch((error) => {
  console.error("\nFATAL ERROR during database reset:", error);
  process.exit(1);
});
