import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { computeStandings, matchesQuery, parseCategory, teamsQuery, useLiveTournament, useCategory, PHASE_LABELS, type Gender, type Match, type Team } from "@/lib/tournament";
import { MatchCard } from "@/components/MatchCard";
import { cn } from "@/lib/utils";
import { StateBadge } from "@/components/StateBadge";
import { TeamLogo } from "@/components/TeamLogo";
import { BracketEditDialog, type BracketTarget } from "@/components/BracketEditDialog";
import { useMyRoles } from "@/lib/use-session-roles";

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
        <Bracket matches={all} teams={teamMap} categoryId={category.id} gender={category.current?.gender} />
      )}
    </section>
  );
}

function BracketBox({ match, teams, label, seeds, onClick }: { onClick?: (() => void) | undefined; match: Match | undefined; teams: Map<string, Team>; label: string; seeds?: [Team | undefined, Team | undefined] | undefined }) {
  const played = match && match.status !== "programado";
  const rows = match
    ? [{ t: teams.get(match.home_team_id), s: match.home_score, o: match.away_score }, { t: teams.get(match.away_team_id), s: match.away_score, o: match.home_score }]
    : [{ t: seeds?.[0], s: 0, o: 0 }, { t: seeds?.[1], s: 0, o: 0 }];
  return (
    <div
      className={cn("w-full rounded-xl border border-border bg-card p-3", onClick && "cursor-pointer transition-colors hover:border-primary")}
      onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && onClick()}
    >
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className={cn("flex items-center gap-2 font-semibold", played && r.s > r.o && "text-accent", !r.t && "text-muted-foreground")}><TeamLogo team={r.t} />{r.t?.name ?? "Por definir"}<StateBadge team={r.t} /></span>
          <span className="font-display text-2xl tabular">{played ? r.s : "-"}</span>
        </div>
      ))}
    </div>
  );
}

function Bracket({ matches, teams, categoryId, gender }: { matches: Match[]; teams: Map<string, Team>; categoryId: string; gender: Gender | undefined }) {
  const semis = matches.filter((m) => m.phase === "semifinal");
  const final = matches.find((m) => m.phase === "final");
  const s1 = semis.find((m) => m.bracket_slot === 1) ?? semis[0];
  const s2 = semis.find((m) => m.bracket_slot === 2 && m !== s1) ?? semis.find((m) => m !== s1);
  // Until semis are seeded, show the current Top-4 from the general table.
  const regular = matches.filter((m) => m.phase === "grupos" || m.phase === "cruce");
  const top = computeStandings([...teams.values()], regular).map((r) => r.team);
  const roles = useMyRoles();
  const [edit, setEdit] = useState<BracketTarget | null>(null);
  const winner = (m: Match | undefined) => (m && m.status === "final" && m.home_score !== m.away_score ? (m.home_score > m.away_score ? m.home_team_id : m.away_team_id) : undefined);
  const w1 = winner(s1); const w2 = winner(s2);
  const seed1: [Team | undefined, Team | undefined] = [top[0], top[3]];
  const seed2: [Team | undefined, Team | undefined] = [top[1], top[2]];
  const seedF: [Team | undefined, Team | undefined] = [w1 ? teams.get(w1) : undefined, w2 ? teams.get(w2) : undefined];
  const open = (t: BracketTarget) => (roles.canScore ? () => setEdit(t) : undefined);
  const champion = final && winner(final) ? teams.get(winner(final)!) : undefined;
  return (
    <div className="space-y-6">
      {champion && (
        <div className="rounded-xl border-2 border-accent bg-card p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Campeón del Torneo</div>
          <div className="font-display text-4xl text-accent">🏆 {champion.name}</div>
        </div>
      )}
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-6">
          <BracketBox match={s1} teams={teams} label={s1 ? "Semifinal 1" : "Semifinal 1 · 1.º vs 4.º"} seeds={seed1}
            onClick={open({ label: "Semifinal 1", phase: "semifinal", slot: 1, match: s1, home: seed1[0]?.id, away: seed1[1]?.id })} />
          <BracketBox match={s2} teams={teams} label={s2 ? "Semifinal 2" : "Semifinal 2 · 2.º vs 3.º"} seeds={seed2}
            onClick={open({ label: "Semifinal 2", phase: "semifinal", slot: 2, match: s2, home: seed2[0]?.id, away: seed2[1]?.id })} />
        </div>
        <div className="hidden font-display text-4xl text-primary md:block">→</div>
        <BracketBox match={final} teams={teams} label="🏆 Final" seeds={seedF}
          onClick={open({ label: "Gran Final", phase: "final", slot: 1, match: final, home: seedF[0]?.id, away: seedF[1]?.id })} />
      </div>
      <BracketEditDialog target={edit} teams={[...teams.values()]} isAdmin={roles.isAdmin} categoryId={categoryId} gender={gender} onClose={() => setEdit(null)} />
    </div>
  );
}
