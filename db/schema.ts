import { pgTable, serial, text, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const mediaItems = pgTable("media_items", {
  id: serial().primaryKey(),
  type: text().notNull(),
  title: text().notNull(),
  genre: text().notNull(),
  creator: text().notNull(),
  description: text().notNull().default("No description provided."),
  thumbnail: text().notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const episodes = pgTable("episodes", {
  id: serial().primaryKey(),
  mediaItemId: integer("media_item_id").notNull().references(() => mediaItems.id),
  season: integer().notNull().default(1),
  episode: integer().notNull().default(1),
  name: text().notNull().default(""),
  url: text().notNull(),
});

// PR Team candidate submissions awaiting CEO Cabin review
export const nominations = pgTable("nominations", {
  id: serial().primaryKey(),
  candidateName: text("candidate_name").notNull(),
  proposedRole: text("proposed_role").notNull(),
  email: text().notNull().default(""),
  phone: text().notNull().default(""),
  details: text().notNull().default(""),
  submittedBy: text("submitted_by").notNull(),
  status: text().notNull().default("pending"), // pending | approved | rejected
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("nominations_status_idx").on(t.status)]);

// Staff account IDs. Each rotation deactivates the old row and issues a new one for the same member_key.
export const teamAccounts = pgTable("team_accounts", {
  id: serial().primaryKey(),
  accountNumber: text("account_number").notNull().unique(),
  memberKey: text("member_key").notNull(),
  memberName: text("member_name").notNull(),
  title: text().notNull().default(""),
  role: text().notNull().default("employee"),
  nominationId: integer("nomination_id").references(() => nominations.id),
  status: text().notNull().default("active"), // active | deactivated
  isPermanent: boolean("is_permanent").notNull().default(false),
  issuedBy: text("issued_by").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  deactivatedAt: timestamp("deactivated_at"),
}, (t) => [
  uniqueIndex("team_accounts_one_active_per_member").on(t.memberKey).where(sql`status = 'active'`),
]);
