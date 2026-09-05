import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

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
