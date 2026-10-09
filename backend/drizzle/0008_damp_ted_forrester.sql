CREATE TABLE "creative_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"creative_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "approval_requested_by" integer;--> statement-breakpoint
ALTER TABLE "creative_approvals" ADD CONSTRAINT "creative_approvals_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_approval_requested_by_users_id_fk" FOREIGN KEY ("approval_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;