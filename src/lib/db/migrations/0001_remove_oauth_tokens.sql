-- Migra de OAuth Web Client (com tokens criptografados em repouso) para Service Account.
-- Tokens não ficam mais no banco — a chave do SA fica em arquivo /secrets/.
-- google_connection vira tabela de "estado de sincronização".

ALTER TABLE "google_connection" DROP COLUMN IF EXISTS "google_email";
--> statement-breakpoint
ALTER TABLE "google_connection" DROP COLUMN IF EXISTS "access_token_enc";
--> statement-breakpoint
ALTER TABLE "google_connection" DROP COLUMN IF EXISTS "refresh_token_enc";
--> statement-breakpoint
ALTER TABLE "google_connection" DROP COLUMN IF EXISTS "expires_at";
--> statement-breakpoint
ALTER TABLE "google_connection" ALTER COLUMN "calendar_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "google_connection" ADD COLUMN IF NOT EXISTS "service_account_email" text;
