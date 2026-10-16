CREATE TABLE "nominations" (
	"id" serial PRIMARY KEY,
	"candidate_name" text NOT NULL,
	"proposed_role" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"submitted_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_accounts" (
	"id" serial PRIMARY KEY,
	"account_number" text NOT NULL UNIQUE,
	"member_key" text NOT NULL,
	"member_name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"nomination_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"issued_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"deactivated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "nominations_status_idx" ON "nominations" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_accounts_one_active_per_member" ON "team_accounts" ("member_key") WHERE status = 'active';--> statement-breakpoint
ALTER TABLE "team_accounts" ADD CONSTRAINT "team_accounts_nomination_id_nominations_id_fkey" FOREIGN KEY ("nomination_id") REFERENCES "nominations"("id");