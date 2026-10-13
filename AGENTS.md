<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Match scores are computed by DB triggers from `match_events`; never write scores from the client (single source of truth).
- Standings and leaders are derived client-side in `src/lib/tournament.ts` from matches/events (no stored aggregates to drift).
- Write access is gated by `user_roles` via `can_score()` RLS (admin or planillero); public tables are anon-readable.
- Tournament categories live in the `categories` table; teams/matches use `category_id`, legacy `category` gender column is kept in sync by trigger.
- PWA is manifest-only (no service worker) to keep previews safe.
