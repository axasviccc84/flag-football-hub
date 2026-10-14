import type { Team } from "@/lib/tournament";

export type Pair = { home: Team; away: Team; round: number; group?: string | null | undefined };

const sameState = (a: Team, b: Team) => !!a.state && !!b.state && a.state.trim().toLowerCase() === b.state.trim().toLowerCase();
const key = (a: Team, b: Team) => [a.id, b.id].sort().join("|");
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Circle-method round robin: every team plays everyone once. */
export function roundRobin(teams: Team[], group?: string | null): Pair[] {
  const list: (Team | null)[] = [...teams];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const out: Pair[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) out.push({ home: r % 2 ? b : a, away: r % 2 ? a : b, round: r + 1, group: group ?? null });
    }
    list.splice(1, 0, list.pop()!);
  }
  return out;
}

/** Random ranking rounds; strongly prefers rivals from other states and no rematches. */
export function rankingRounds(teams: Team[], rounds: number): Pair[] {
  const played = new Set<string>();
  const out: Pair[] = [];
  for (let r = 1; r <= rounds; r++) {
    let best: Pair[] = []; let bestCost = Infinity;
    for (let attempt = 0; attempt < 300; attempt++) {
      const pool = shuffle(teams); const pairs: Pair[] = []; let cost = 0;
      while (pool.length > 1) {
        const a = pool.shift()!;
        let idx = pool.findIndex((b) => !sameState(a, b) && !played.has(key(a, b)));
        if (idx < 0) { idx = pool.findIndex((b) => !played.has(key(a, b))); cost += 10; }
        if (idx < 0) { idx = 0; cost += 100; }
        const b = pool.splice(idx, 1)[0]!;
        if (sameState(a, b)) cost += 10;
        pairs.push({ home: a, away: b, round: r });
      }
      if (cost < bestCost) { best = pairs; bestCost = cost; if (cost === 0) break; }
    }
    best.forEach((p) => played.add(key(p.home, p.away)));
    out.push(...best);
  }
  return out;
}

/** Splits teams into groups spreading teams of the same state across different groups. */
export function splitGroups(teams: Team[], count: number): Map<string, Team[]> {
  const names = "ABCDEFGH".slice(0, count).split("");
  const groups = new Map(names.map((g) => [g, [] as Team[]]));
  const byState = new Map<string, Team[]>();
  for (const t of shuffle(teams)) {
    const s = t.state?.trim().toLowerCase() || `_${t.id}`;
    byState.set(s, [...(byState.get(s) ?? []), t]);
  }
  const ordered = [...byState.values()].sort((a, b) => b.length - a.length).flat();
  for (const t of ordered) {
    const target = names
      .map((g) => ({ g, list: groups.get(g)! }))
      .sort((x, y) => x.list.filter((o) => sameState(o, t)).length - y.list.filter((o) => sameState(o, t)).length || x.list.length - y.list.length)[0];
    target!.list.push(t);
  }
  return groups;
}

export function stateTag(t: Team | undefined) {
  const s = t?.state?.trim();
  return s ? s.slice(0, 3).toUpperCase() : "";
}
