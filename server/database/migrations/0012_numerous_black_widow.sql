CREATE INDEX "idx_bookmarks_deleted" ON "bookmarks" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user_deleted" ON "bookmarks" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_saved" ON "bookmarks" USING btree ("saved_at");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_updated" ON "bookmarks" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_notes_deleted" ON "notes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_notes_user_deleted" ON "notes" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_notes_updated" ON "notes" USING btree ("updated_at");