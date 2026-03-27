CREATE TABLE "notes_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "markdown_notes" RENAME TO "notes";--> statement-breakpoint
ALTER TABLE "secret_notes" RENAME TO "secrets";--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "markdown_notes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "secrets" DROP CONSTRAINT "secret_notes_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "idx_markdown_notes_user";--> statement-breakpoint
DROP INDEX "idx_markdown_notes_created";--> statement-breakpoint
DROP INDEX "idx_markdown_notes_is_favorite";--> statement-breakpoint
DROP INDEX "idx_secret_notes_user";--> statement-breakpoint
DROP INDEX "idx_secret_notes_created";--> statement-breakpoint
CREATE INDEX "idx_notes_tags_note" ON "notes_tags" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "idx_notes_tags_tag" ON "notes_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notes_tags_unique" ON "notes_tags" USING btree ("note_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_secrets_tags_secret" ON "secrets_tags" USING btree ("secret_id");--> statement-breakpoint
CREATE INDEX "idx_secrets_tags_tag" ON "secrets_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_secrets_tags_unique" ON "secrets_tags" USING btree ("secret_id","tag_id");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notes_user" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notes_created" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notes_is_favorite" ON "notes" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "idx_secrets_user" ON "secrets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_secrets_created" ON "secrets" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "notes" DROP COLUMN "tags";