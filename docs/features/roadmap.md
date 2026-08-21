# Roadmap — confirmed 2026-08-21

Three workstreams, planned together and sequenced below. Each links to its own
plan doc.

## 1. In parallel (independent, neither touches the unification surface)

### [Video embeds](video-embeds.md)
Contained to `server/api/scrape.ts`, `composables/useMarkdown.ts`, one new
`VideoEmbed.vue`, and one CSP directive. Also fixes the `VIDEO_PATTERNS`
misclassification that currently routes every tweet and Instagram post into the
placeholder branch with no scrape — a whole class of bookmarks silently
degrading today.

### [Device enrollment](device-enrollment.md)
Entirely separate from the web app: new `device_enrollments` table, two
endpoints, a Devices section on `/profile`, and the iOS client changes. The one
thing to get right is the **rotation grace window** — without it, concurrent
refreshes from the app and the share extension turn a stale-token annoyance into
a hard self-revoking logout.

## 2. Then: [unified items](unified-items.md), phased

Phases 1–2 (schema + server adapters, then the client model) are the risky half
and are invisible to the user. Phases 3–4 are where it starts feeling like one
app. Phase 5 drops the old tables.

## 3. Last: quick create (the `n` hotkey)

Planned in [unified-items.md](unified-items.md#quick-create-the-n-hotkey).
Deliberately last: under the unified API it is one call with an optional `url`
rather than a branch between `/api/scrape` and `createNote`. Building it before
the merge means building it twice.

---

## Two decisions to settle before unification Phase 1

**Sync across the IDB v3→v4 boundary.** An old client pushing to a new server is
covered by the adapters; the reverse is not. Recommendation: force a full
re-pull on the IDB upgrade rather than attempting a cross-version merge. Simpler,
and the data all lives server-side anyway.

**When to drop the old tables.** The plan assumes one full release of `items`
running clean before Phase 5. That window is the rollback path — shortening it
removes the escape hatch.
