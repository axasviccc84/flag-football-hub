import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { matchesQuery, parseCategory, teamsQuery, useLiveTournament, useCategory, PHASE_LABELS, type Match, type Team } from "@/lib/tournament";
import { MatchCard } from "@/components/MatchCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendario")({
  validateSearch: (s: Record<string, unknown>) => ({ cat: parseCategory(s["cat"]) }),
  head: () => ({
    meta: [
      { title: "Calendario de Partidos · Torneo Flag Football" },
      { name: "description", content: "Fechas, horarios, campos, resultados y bracket de playoffs del torneo de Flag Football." },
      { property: "og:title", content: "Calendario · Torneo Flag Football" },
      { property: "og:description", content: "Consulta los partidos por jornada y grupo, y sigue el bracket de playoffs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calendar,
});

function Calendar() {
  const { cat } = Route.useSearch();
  const category = useCategory(cat);
  useLiveTournament();
  const [tab, setTab] = useState<"jornadas" | "bracket">("jornadas");
  const teams = useQuery({ ...teamsQuery(category.id), enabled: !!category.id });
  const matches = useQuery({ ...matchesQuery(category.id), enabled: !!category.id });
  const teamMap = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const all = matches.data ?? [];

  const sections = new Map<string, Match[]>();
  for (const m of all.filter((m) => m.phase === "grupos" || m.phase === "cruce")) {
    const key = m.phase === "cruce" ? `Jornada 3 · ${PHASE_LABELS.cruce}` : `Jornada ${m.round}${m.group_name ? ` · Grupo ${m.group_name}` : ""}`;
    sections.set(key, [...(sections.get(key) ?? []), m]);
  }
  const ordered = [...sections.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="space-y-6">
      <h1 className="text-4xl">Calendario</h1>
      <div className="flex gap-2">
        {(["jornadas", "bracket"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg border-2 px-4 py-2 font-display text-lg", tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
            {t === "jornadas" ? "Jornadas" : "Bracket Playoffs"}
          </button>
        ))}
      </div>
      {matches.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {tab === "jornadas" ? (
        <>
          {!matches.isLoading && ordered.length === 0 && <p className="text-muted-foreground">Aún no hay partidos programados.</p>}
          {ordered.map(([title, list]) => (
            <div key={title}>
              <h2 className="mb-3 text-2xl text-primary">{title}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((m) => <MatchCard key={m.id} match={m} teams={teamMap} />)}
              </div>
            </div>
          ))}
        </>
      ) : (
        <Bracket matches={all} teams={teamMap} />
      )}
    </section>
  );
}

function BracketBox({ match, teams, label }: { match?: Match; teams: Map<string, Team>; label: string }) {
  const played = match && match.status !== "programado";
  const rows = match
    ? [{ t: teams.get(match.home_team_id), s: match.home_score, o: match.away_score }, { t: teams.get(match.away_team_id), s: match.away_score, o: match.home_score }]
    : [{ t: undefined, s: 0, o: 0 }, { t: undefined, s: 0, o: 0 }];
  return (
    <div className="w-full rounded-xl border border-border bg-card p-3">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className={cn("font-semibold", played && r.s > r.o && "text-accent", !r.t && "text-muted-foreground")}>{r.t?.name ?? "Por definir"}</span>
          <span className="font-display text-2xl tabular">{played ? r.s : "-"}</span>
        </div>
      ))}
    </div>
  );
}

function Bracket({ matches, teams }: { matches: Match[]; teams: Map<string, Team> }) {
  const semis = matches.filter((m) => m.phase === "semifinal");
  const final = matches.find((m) => m.phase === "final");
  const s1 = semis.find((m) => m.bracket_slot === 1) ?? semis[0];
  const s2 = semis.find((m) => m.bracket_slot === 2 && m !== s1) ?? semis.find((m) => m !== s1);
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
      <div className="space-y-6">
        <BracketBox match={s1} teams={teams} label="Semifinal 1" />
        <BracketBox match={s2} teams={teams} label="Semifinal 2" />
      </div>
      <div className="hidden font-display text-4xl text-primary md:block">→</div>
      <BracketBox match={final} teams={teams} label="🏆 Final" />
    </div>
  );
}
