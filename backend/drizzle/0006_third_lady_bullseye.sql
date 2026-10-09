ALTER TABLE "creatives" DROP CONSTRAINT "creatives_funnel_id_funnels_id_fk";
--> statement-breakpoint
ALTER TABLE "funnels" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- O funil mais antigo (o "Geral" da 0005) vira o padrão.
UPDATE "funnels" SET "is_default" = true WHERE "id" = (SELECT min("id") FROM "funnels");--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funnels_one_default_idx" ON "funnels" USING btree ("is_default") WHERE "funnels"."is_default";