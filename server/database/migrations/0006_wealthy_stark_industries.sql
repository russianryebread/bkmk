ALTER TABLE "tags" ADD COLUMN "type" text DEFAULT 'both';--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "icon" text;--> statement-breakpoint
CREATE INDEX "idx_tags_type" ON "tags" USING btree ("type");