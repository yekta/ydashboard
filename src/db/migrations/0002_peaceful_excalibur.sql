ALTER TABLE "card_types" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "card_type_id" SET DATA TYPE text;