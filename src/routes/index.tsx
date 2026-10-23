import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { computeStandings, matchesQuery, parseCategory, teamsQuery, useLiveTournament, useCategory } from "@/lib/tournament";
import { TeamLogo } from "@/components/TeamLogo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({ cat: parseCategory(s["cat"]) }),
  head: () => ({
    meta: [
      { title: "Tabla de Posiciones · Torneo Flag Football IFAF" },
      { name: "description", content: "Posiciones en vivo del torneo de Flag Football: Varonil, Femenil y Mixto con reglas IFAF 2023." },
      { property: "og:title", content: "Tabla de Posiciones · Torneo Flag Football" },
      { property: "og:description", content: "PJ, PG, PE, PP, PF, PC, DIF y PTS actualizados en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Standings,
});

function Standings() {
  const { cat } = Route.useSearch();
  const category = useCategory(cat);
  useLiveTournament();
  const teams = useQuery({ ...teamsQuery(category.id), enabled: !!category.id });
  const matches = useQuery({ ...matchesQuery(category.id), enabled: !!category.id });
  const rows = computeStandings(teams.data ?? [], matches.data ?? []);
  const label = category.current?.name;

  return (
    <section>
      <h1 className="text-4xl">Posiciones <span className="text-primary">{label}</span></h1>
      <p className="mb-4 text-sm text-muted-foreground">Victoria 3 pts · Empate 1 pt · Solo partidos finalizados</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm tabular">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Equipo</th>
              {["PJ", "PG", "PE", "PP", "PF", "PC", "DIF"].map((h) => (
                <th key={h} className="px-2 py-3 text-center">{h}</th>
              ))}
              <th className="px-3 py-3 text-center text-primary">PTS</th>
            </tr>
          </thead>
          <tbody>
            {teams.isLoading && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.team.id} className="border-t border-border">
                <td className={cn("px-3 py-3 font-display text-xl", i === 0 ? "text-accent" : "text-muted-foreground")}>{i + 1}</td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2">
                    <TeamLogo team={r.team} />
                    <span className="font-semibold">{r.team.name}</span>
                  </span>
                </td>
                <td className="px-2 py-3 text-center">{r.jj}</td>
                <td className="px-2 py-3 text-center">{r.jg}</td>
                <td className="px-2 py-3 text-center">{r.je}</td>
                <td className="px-2 py-3 text-center">{r.jp}</td>
                <td className="px-2 py-3 text-center">{r.pf}</td>
                <td className="px-2 py-3 text-center">{r.pc}</td>
                <td className={cn("px-2 py-3 text-center", r.dif > 0 && "text-success", r.dif < 0 && "text-destructive")}>
                  {r.dif > 0 ? `+${r.dif}` : r.dif}
                </td>
                <td className="px-3 py-3 text-center font-display text-xl text-primary">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
