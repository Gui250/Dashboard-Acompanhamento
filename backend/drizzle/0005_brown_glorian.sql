CREATE TABLE "funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "funnels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- Criativos que já existiam vão para o funil "Geral".
INSERT INTO "funnels" ("name") VALUES ('Geral');--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "funnel_id" integer;--> statement-breakpoint
UPDATE "creatives" SET "funnel_id" = (SELECT "id" FROM "funnels" WHERE "name" = 'Geral');--> statement-breakpoint
ALTER TABLE "creatives" ALTER COLUMN "funnel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;