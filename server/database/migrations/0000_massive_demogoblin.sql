CREATE TABLE "bookmark_images" (
	"id" text PRIMARY KEY NOT NULL,
	"bookmark_id" text NOT NULL,
	"file_path" text NOT NULL,
	"alt_text" text,
	"position_in_article" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookmark_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"bookmark_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"original_html" text,
	"cleaned_markdown" text,
	"reading_time_minutes" integer,
	"saved_at" timestamp DEFAULT now(),
	"last_accessed_at" timestamp,
	"is_favorite" integer DEFAULT 0,
	"sort_order" integer,
	"thumbnail_image_path" text,
	"is_read" integer DEFAULT 0,
	"read_at" timestamp,
	"source_domain" text,
	"word_count" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "markdown_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"tags" text DEFAULT '',
	"is_favorite" integer DEFAULT 0,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "secret_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_accessed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sync_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"last_modified_at" timestamp DEFAULT now(),
	"is_deleted" integer DEFAULT 0,
	"sync_status" text DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_tag_id" text,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markdown_notes" ADD CONSTRAINT "markdown_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_notes" ADD CONSTRAINT "secret_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookmark_images_bookmark" ON "bookmark_images" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "idx_bookmark_tags_bookmark" ON "bookmark_tags" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "idx_bookmark_tags_tag" ON "bookmark_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bookmark_tags_unique" ON "bookmark_tags" USING btree ("bookmark_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_created" ON "bookmarks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_is_favorite" ON "bookmarks" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_source_domain" ON "bookmarks" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_is_read" ON "bookmarks" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_markdown_notes_user" ON "markdown_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_markdown_notes_created" ON "markdown_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_markdown_notes_is_favorite" ON "markdown_notes" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "idx_secret_notes_user" ON "secret_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_secret_notes_created" ON "secret_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sync_metadata_status" ON "sync_metadata" USING btree ("sync_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_metadata_unique" ON "sync_metadata" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_tags_user" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tags_name" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_tags_parent" ON "tags" USING btree ("parent_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tags_user_name" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_created" ON "users" USING btree ("created_at");