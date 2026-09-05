CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY,
	"media_item_id" integer NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"episode" integer DEFAULT 1 NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"genre" text NOT NULL,
	"creator" text NOT NULL,
	"description" text DEFAULT 'No description provided.' NOT NULL,
	"thumbnail" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_media_item_id_media_items_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id");