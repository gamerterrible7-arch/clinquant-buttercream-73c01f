import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { teamAccounts } from "../../db/schema.js";

// Excludes look-alike characters (0/O, 1/I/L) so IDs can be read aloud or typed from a screenshot.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Executive profiles that are never rotated out.
export const PERMANENT_PROFILES = [
  { memberKey: "mubashir_holmes", memberName: "CEO Mubashir Holmes", title: "Chief Executive Officer", role: "ceo" },
  { memberKey: "hassan_nolan", memberName: "Hassan Nolan", title: "Co-Executive", role: "co_exec" },
];

// Produces IDs like NFG-7KQ2-M9XA-T4PE (12 random chars ≈ 59 bits of entropy).
export function generateAccountNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `NFG-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

type NewAccount = {
  memberKey: string;
  memberName: string;
  title: string;
  role: string;
  nominationId?: number | null;
  isPermanent?: boolean;
  issuedBy: string;
};

// Inserts an account with a fresh unique ID, retrying on the (very unlikely) collision.
export async function issueAccount(account: NewAccount, tx: any = db) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const accountNumber = generateAccountNumber();
    const [existing] = await tx
      .select({ id: teamAccounts.id })
      .from(teamAccounts)
      .where(eq(teamAccounts.accountNumber, accountNumber));
    if (existing) continue;

    const [row] = await tx
      .insert(teamAccounts)
      .values({ ...account, accountNumber, status: "active" })
      .returning();
    return row;
  }
  throw new Error("Could not allocate a unique account number. Please retry.");
}

export async function ensurePermanentProfiles() {
  for (const profile of PERMANENT_PROFILES) {
    const [existing] = await db
      .select({ id: teamAccounts.id })
      .from(teamAccounts)
      .where(and(eq(teamAccounts.memberKey, profile.memberKey), eq(teamAccounts.status, "active")));
    if (existing) continue;
    try {
      await issueAccount({ ...profile, isPermanent: true, issuedBy: "system" });
    } catch {
      // A concurrent request created it first; the partial unique index guarantees one active row.
    }
  }
}

// Deactivates every non-permanent active account and issues each member a replacement ID.
export async function rotateStaffAccounts(issuedBy: string) {
  const active = await db
    .select()
    .from(teamAccounts)
    .where(and(eq(teamAccounts.status, "active"), eq(teamAccounts.isPermanent, false)));

  const rotated: { memberName: string; oldAccountNumber: string; newAccountNumber: string }[] = [];

  for (const account of active) {
    await db.transaction(async (tx) => {
      await tx
        .update(teamAccounts)
        .set({ status: "deactivated", deactivatedAt: new Date() })
        .where(eq(teamAccounts.id, account.id));

      const fresh = await issueAccount(
        {
          memberKey: account.memberKey,
          memberName: account.memberName,
          title: account.title,
          role: account.role,
          nominationId: account.nominationId,
          issuedBy,
        },
        tx
      );
      rotated.push({ memberName: account.memberName, oldAccountNumber: account.accountNumber, newAccountNumber: fresh.accountNumber });
    });
  }

  return rotated;
}
