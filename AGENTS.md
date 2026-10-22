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
- Match scores are computed by DB triggers from `match_events`; the only client score write allowed is a manual result in the bracket dialog for matches with zero captured events.
- Standings and leaders are derived client-side in `src/lib/tournament.ts` from matches/events (no stored aggregates to drift).
- Write access is gated by `user_roles` via `can_score()` RLS (admin or planillero); public tables are anon-readable.
- Tournament categories live in the `categories` table; teams/matches use `category_id`, legacy `category` gender column is kept in sync by trigger.
- PWA is manifest-only (no service worker) to keep previews safe.
- Playoff Final is auto-filled by the advance_bracket DB trigger when all semifinals end; single-semi formats store the waiting seed in matches.bye_team_id.
