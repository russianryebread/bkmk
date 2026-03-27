CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"bookmark_id" text NOT NULL,
	"original_url" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "bookmark_images" CASCADE;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_images_bookmark" ON "images" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "idx_images_original_url" ON "images" USING btree ("original_url");