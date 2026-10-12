import { useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Enums"]["category"];
export type EventType = Database["public"]["Enums"]["event_type"];
export type MatchStatus = Database["public"]["Enums"]["match_status"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "varonil", label: "Varonil" },
  { value: "femenil", label: "Femenil" },
  { value: "mixto", label: "Mixto" },
];

export const EVENT_LABELS: Record<EventType, { label: string; short: string; points: number }> = {
  td: { label: "Touchdown", short: "TD", points: 6 },
  conv1: { label: "Conversión 1 pt", short: "C1", points: 1 },
  conv2: { label: "Conversión 2 pts", short: "C2", points: 2 },
  safety: { label: "Safety", short: "SAF", points: 2 },
  int: { label: "Intercepción", short: "INT", points: 0 },
  sack: { label: "Sack", short: "SACK", points: 0 },
};

export const STATUS_LABELS: Record<MatchStatus, string> = {
  programado: "Programado",
  en_vivo: "En vivo",
  final: "Final",
};

export function parseCategory(v: unknown): Category {
  return v === "femenil" || v === "mixto" ? v : "varonil";
}

export const teamsQuery = (cat: Category) =>
  queryOptions({
    queryKey: ["teams", cat],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").eq("category", cat).order("name");
      if (error) throw error;
      return data;
    },
  });

export const matchesQuery = (cat?: Category) =>
  queryOptions({
    queryKey: ["matches", cat ?? "all"],
    queryFn: async () => {
      let q = supabase.from("matches").select("*").order("scheduled_at");
      if (cat) q = q.eq("category", cat);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const allTeamsQuery = () =>
  queryOptions({
    queryKey: ["teams", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

export const eventsByCategoryQuery = (cat: Category) =>
  queryOptions({
    queryKey: ["events", "cat", cat],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events")
        .select("*, matches!inner(category)")
        .eq("matches.category", cat);
      if (error) throw error;
      return data as unknown as MatchEvent[];
    },
  });

export const eventsByMatchQuery = (matchId: string) =>
  queryOptions({
    queryKey: ["events", "match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

/** Live updates: refresh cached data whenever matches or events change. */
export function useLiveTournament() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("tournament-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () =>
        qc.invalidateQueries({ queryKey: ["matches"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export type StandingRow = {
  team: Team;
  jj: number; jg: number; jp: number; je: number;
  pf: number; pc: number; dif: number; pts: number;
};

/** Win = 3, tie = 1, loss = 0. Only finished matches count. */
export function computeStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [t.id, { team: t, jj: 0, jg: 0, jp: 0, je: 0, pf: 0, pc: 0, dif: 0, pts: 0 }]),
  );
  for (const m of matches) {
    if (m.status !== "final") continue;
    const h = rows.get(m.home_team_id);
    const a = rows.get(m.away_team_id);
    if (!h || !a) continue;
    h.jj++; a.jj++;
    h.pf += m.home_score; h.pc += m.away_score;
    a.pf += m.away_score; a.pc += m.home_score;
    if (m.home_score > m.away_score) { h.jg++; a.jp++; h.pts += 3; }
    else if (m.home_score < m.away_score) { a.jg++; h.jp++; a.pts += 3; }
    else { h.je++; a.je++; h.pts++; a.pts++; }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, dif: r.pf - r.pc }))
    .sort((x, y) => y.pts - x.pts || y.dif - x.dif || y.pf - x.pf || x.team.name.localeCompare(y.team.name));
}

export type LeaderRow = {
  key: string; team: Team | undefined; jersey: number;
  td: number; conv1: number; conv2: number; safety: number; int: number; sack: number; points: number;
};

export function computeLeaders(events: MatchEvent[], teams: Team[]): LeaderRow[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const map = new Map<string, LeaderRow>();
  for (const e of events) {
    const key = `${e.team_id}-${e.jersey}`;
    let row = map.get(key);
    if (!row) {
      row = { key, team: byId.get(e.team_id), jersey: e.jersey, td: 0, conv1: 0, conv2: 0, safety: 0, int: 0, sack: 0, points: 0 };
      map.set(key, row);
    }
    row[e.event_type]++;
    row.points += e.points;
  }
  return [...map.values()];
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
