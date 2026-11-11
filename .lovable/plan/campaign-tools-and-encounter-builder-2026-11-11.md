# Campaign Tools and Encounter Builder

## Goal
Add the requested campaign Quest Log, Handouts, DM AI tools, Lite Lore Wiki, and uploaded Open5e Monster Library/Encounter Builder without changing the app's existing themes or campaign workflows beyond adding tabs.

## User-facing changes
- Add DM campaign tabs for Quests, Handouts, Lore, and Monsters; each new view uses the campaign selected in the existing dashboard.
- Add player journal tabs for visible campaign quests, revealed handouts, and visible lore pages. Support multiple linked campaigns for a character; visibility is enforced by the database.
- Give DMs objective/status/visibility controls for quests, reveal/hide and file controls for handouts, searchable editable lore pages with `[[Page Title]]` links, and NPC/recap AI generation with previews and a daily limit.
- Add Open5e search, monster detail, encounter quantities/difficulty, saved encounters, and send-to-existing-initiative functionality for DMs only.

## Technical approach
1. Apply one additive Lovable Cloud migration for campaign-owned quests/objectives, handouts, lore pages, AI usage, and saved encounters, with explicit grants, RLS, indexes, and realtime publication for quest tables and handouts. Ensure existing campaign journal storage is reused or add the requested approved recap table if absent. Create the public handouts bucket using the Storage tool and folder-scoped DM-only write policies; public reads are intentional for the requested public image bucket.
2. Reuse the current authenticated Supabase browser client, existing campaign membership/DM checks, current app theme classes/variables, and established modal patterns. Record only the durable architectural rule for these new campaign modules in `AGENTS.md`.
3. Build focused campaign components for quest management/player views, handout management/player views and notifications, lore management/player views, and monster library/encounters. Keep player data loads constrained by campaign membership and visibility RLS.
4. Add a single authenticated `/api/dm-ai` TanStack server endpoint for NPC JSON and plain-text recaps, reusing the current AI provider/secret. Enforce DM eligibility and a durable per-day 20-call cap in the database; save generated NPCs/recaps only after explicit confirmation.
5. Connect Monster encounter actions to existing combat tables/session flow without replacing the Initiative Tracker; avoid displaying Monster Library data to players.
6. Run focused tests, typecheck/build via the project harness signals, review runtime logs, and update `roadmap.md`.

## Technical details
- Player character membership may point to multiple campaigns, so player campaign tabs will aggregate linked campaigns rather than silently choosing one.
- `user_preferences.is_gm` is the app's existing DM authorization signal; the AI endpoint will verify it on the server instead of trusting client state.
- AI generation will use the project's current Lovable AI provider and secret; never expose provider credentials to the browser.
- Monster encounter difficulty uses standard 5E per-level XP thresholds and the group-size multiplier in a single tested utility.
- The uploaded Monster brief prohibits changes to the existing Initiative Tracker; new actions will write its existing combat session/combatant rows.
