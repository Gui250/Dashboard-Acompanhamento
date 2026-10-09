UPDATE "users"
SET "role_id" = admin.id
FROM "roles" AS admin
WHERE admin.name = 'Administrador'
  AND lower(btrim("users"."name")) IN ('guilherme moreno', 'guilherme soares moreno');
