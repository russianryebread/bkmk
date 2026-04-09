DROP TABLE "secrets" CASCADE;--> statement-breakpoint
DROP TABLE "secrets_tags" CASCADE;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "deleted_at" timestamp;