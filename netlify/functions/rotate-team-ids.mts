import type { Config } from "@netlify/functions";
import { ensurePermanentProfiles, rotateStaffAccounts } from "../lib/accounts.js";

// Runs at the start of each billing cycle: deactivates every staff account ID and issues
// replacements. Permanent executive profiles (the CEO's included) are left untouched.
export default async () => {
  await ensurePermanentProfiles();
  const rotated = await rotateStaffAccounts("monthly rotation");
  console.log(`Monthly ID rotation complete: ${rotated.length} staff account(s) reissued.`);
};

export const config: Config = {
  schedule: "0 0 6 * *", // 00:00 UTC on the 6th of every month
};
