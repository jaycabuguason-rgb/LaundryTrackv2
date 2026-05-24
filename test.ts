import { listLoyaltyMembers } from "./lib/server/loyalty-repository.js";

async function run() {
  try {
    const res = await listLoyaltyMembers();
    console.log(res);
  } catch (err) {
    console.error("ERROR:", err);
  }
}
run();
