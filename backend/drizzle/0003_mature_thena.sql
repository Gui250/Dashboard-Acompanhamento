CREATE TABLE "creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"account" text NOT NULL,
	"format" text NOT NULL,
	"owner" text NOT NULL,
	"stage" text DEFAULT 'briefing' NOT NULL,
	"image" "bytea",
	"image_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
