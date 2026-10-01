Run `bunx vite --config tests/browser/vite.config.ts`, then open
http://127.0.0.1:3012/index.html. This mounts the real editor and data store
with real browser IndexedDB and an isolated in-memory API adapter. It never
uses your account or production database.

Click **Run sync regressions**: all three results should be true. This checks
500 and timeout failures settle promptly, queued writes survive, failures do
not fan out to individual retries, and a successful retry saves the latest edit.

Editor checks: type/paste multiline markdown, wrap a long heading, delete and
replace it, press Return after a list item and then after its empty continuation,
and Undo. The JSON beneath the editor should match the text and line breaks.
