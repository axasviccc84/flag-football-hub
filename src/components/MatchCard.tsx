import type { Match, Team } from "@/lib/tournament";
import { STATUS_LABELS, formatDate } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export function MatchCard({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const home = teams.get(match.home_team_id);
  const away = teams.get(match.away_team_id);
  const played = match.status !== "programado";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>J{match.round} · {formatDate(match.scheduled_at)} · {match.field}</span>
        <span
          className={cn(
            "rounded px-2 py-0.5 font-semibold",
            match.status === "en_vivo" && "animate-pulse bg-live text-chalk",
            match.status === "final" && "bg-secondary text-secondary-foreground",
            match.status === "programado" && "border border-border",
          )}
        >
          {STATUS_LABELS[match.status]}
        </span>
      </div>
      {[{ t: home, s: match.home_score, o: match.away_score }, { t: away, s: match.away_score, o: match.home_score }].map((row, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className={cn("font-semibold", played && row.s > row.o && "text-accent")}>{row.t?.name ?? "—"}</span>
          <span className="font-display text-3xl tabular">{played ? row.s : "-"}</span>
        </div>
      ))}
    </div>
  );
}
