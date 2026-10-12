import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { matchesQuery, parseCategory, teamsQuery, useLiveTournament } from "@/lib/tournament";
import { MatchCard } from "@/components/MatchCard";

export const Route = createFileRoute("/calendario")({
  validateSearch: (s: Record<string, unknown>) => ({ cat: parseCategory(s.cat) }),
  head: () => ({
    meta: [
      { title: "Calendario de Partidos · Torneo Flag Football" },
      { name: "description", content: "Fechas, horarios, campos y resultados de cada jornada del torneo de Flag Football." },
      { property: "og:title", content: "Calendario · Torneo Flag Football" },
      { property: "og:description", content: "Consulta los partidos por categoría y sigue los marcadores en vivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calendar,
});

function Calendar() {
  const { cat } = Route.useSearch();
  useLiveTournament();
  const teams = useQuery(teamsQuery(cat));
  const matches = useQuery(matchesQuery(cat));
  const teamMap = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const rounds = new Map<number, typeof matches.data>();
  for (const m of matches.data ?? []) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);

  return (
    <section className="space-y-8">
      <h1 className="text-4xl">Calendario</h1>
      {matches.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {[...rounds.entries()].map(([round, list]) => (
        <div key={round}>
          <h2 className="mb-3 text-2xl text-primary">Jornada {round}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {list!.map((m) => <MatchCard key={m.id} match={m} teams={teamMap} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
