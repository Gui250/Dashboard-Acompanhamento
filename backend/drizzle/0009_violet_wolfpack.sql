CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"permissions" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "roles" ("name", "description", "permissions", "is_system") VALUES
	('Administrador', 'Acesso total ao sistema, equipe e políticas de governança.', '["metrics.view","metrics.manage","kanban.view","kanban.manage","integrations.view","integrations.manage","governance.manage"]', true),
	('Gestor de tráfego pago', 'Configura e mantém as integrações de mídia e automação.', '["integrations.view","integrations.manage"]', true),
	('Vendedor', 'Consulta os indicadores comerciais e operacionais.', '["metrics.view"]', true),
	('Designer', 'Consulta indicadores e administra a esteira criativa.', '["metrics.view","kanban.view","kanban.manage"]', true);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role_id" integer;--> statement-breakpoint
UPDATE "users" SET "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'Vendedor');--> statement-breakpoint
UPDATE "users" SET "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'Administrador') WHERE "id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;
