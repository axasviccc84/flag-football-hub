import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { computeLeaders, eventsByCategoryQuery, parseCategory, teamsQuery, useLiveTournament, type LeaderRow } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lideres")({
  validateSearch: (s: Record<string, unknown>) => ({ cat: parseCategory(s["cat"]) }),
  head: () => ({
    meta: [
      { title: "Tabla de Líderes · Torneo Flag Football" },
      { name: "description", content: "Líderes individuales por número de jersey: puntos, touchdowns, conversiones, intercepciones y sacks." },
      { property: "og:title", content: "Líderes · Torneo Flag Football" },
      { property: "og:description", content: "Quién domina el torneo: TDs, INTs, sacks y puntos por jersey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leaders,
});

const SORTS: { key: keyof LeaderRow; label: string }[] = [
  { key: "points", label: "Puntos" },
  { key: "td", label: "TDs" },
  { key: "int", label: "INTs" },
  { key: "sack", label: "Sacks" },
];

function Leaders() {
  const { cat } = Route.useSearch();
  useLiveTournament();
  const [sort, setSort] = useState<keyof LeaderRow>("points");
  const teams = useQuery(teamsQuery(cat));
  const events = useQuery(eventsByCategoryQuery(cat));
  const rows = computeLeaders(events.data ?? [], teams.data ?? [])
    .filter((r) => (r[sort] as number) > 0)
    .sort((a, b) => (b[sort] as number) - (a[sort] as number) || b.points - a.points);

  return (
    <section>
      <h1 className="text-4xl">Líderes</h1>
      <div className="my-4 flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              sort === s.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm tabular">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Jersey</th>
              <th className="px-3 py-3 text-left">Equipo</th>
              <th className="px-2 py-3 text-center">TD</th>
              <th className="px-2 py-3 text-center">C1</th>
              <th className="px-2 py-3 text-center">C2</th>
              <th className="px-2 py-3 text-center">INT</th>
              <th className="px-2 py-3 text-center">SACK</th>
              <th className="px-3 py-3 text-center text-primary">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !events.isLoading && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sin registros todavía.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-chalk font-display text-xl text-background">{r.jersey}</span>
                </td>
                <td className="px-3 py-3 font-semibold">{r.team?.name}</td>
                <td className={cn("px-2 py-3 text-center", sort === "td" && "font-bold text-primary")}>{r.td}</td>
                <td className="px-2 py-3 text-center">{r.conv1}</td>
                <td className="px-2 py-3 text-center">{r.conv2}</td>
                <td className={cn("px-2 py-3 text-center", sort === "int" && "font-bold text-primary")}>{r.int}</td>
                <td className={cn("px-2 py-3 text-center", sort === "sack" && "font-bold text-primary")}>{r.sack}</td>
                <td className="px-3 py-3 text-center font-display text-xl text-primary">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
