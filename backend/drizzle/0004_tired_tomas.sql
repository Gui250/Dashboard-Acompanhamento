CREATE TABLE "hidden_meta_ads" (
	"ad_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metrics_section_key_date_idx" ON "metrics" USING btree ("section","key","date");