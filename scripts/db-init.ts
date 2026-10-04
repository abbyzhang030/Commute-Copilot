import { getDb } from "../src/db.js";
import { ensureUser } from "../src/coordinator.js";
const db = await getDb();
await ensureUser("demo-user", "Demo User");
console.log(`Schema ready on ${db.kind}; seeded demo-user.`);
process.exit(0);
