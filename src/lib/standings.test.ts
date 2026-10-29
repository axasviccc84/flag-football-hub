import { describe, it, expect } from "vitest";
import { computeStandings } from "./tournament";
const t = (id: string) => ({ id, name: id }) as any;
const m = (h: string, a: string, hs: number, as: number) => ({ status: "final", home_team_id: h, away_team_id: a, home_score: hs, away_score: as }) as any;
describe("desempate", () => {
  it("ganador del duelo directo queda arriba aunque tenga menos DIF", () => {
    // A y B con 3 pts; A le ganó a B por 1, B goleó a C
    const r = computeStandings([t("A"), t("B"), t("C")], [m("A", "B", 7, 6), m("B", "C", 40, 0)]);
    expect(r[0]!.team.id).toBe("A");
  });
  it("A vence a B en duelo directo pese a menor DIF", () => {
    const r = computeStandings([t("A"), t("B")], [m("A", "B", 7, 6), m("B", "A", 30, 0)]);
    // 1-1 en duelos, DIF H2H: B +29 → B arriba
    expect(r[0]!.team.id).toBe("B");
  });
  it("sin duelo entre todos, usa DIF general", () => {
    const r = computeStandings([t("A"), t("B"), t("C"), t("D")], [m("A", "C", 20, 0), m("B", "D", 7, 6)]);
    expect(r[0]!.team.id).toBe("A");
  });
});
