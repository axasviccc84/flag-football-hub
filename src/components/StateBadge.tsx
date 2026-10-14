import type { Team } from "@/lib/tournament";
import { stateTag } from "@/lib/generator";

export function StateBadge({ team }: { team: Team | undefined }) {
  const tag = stateTag(team);
  if (!tag) return null;
  return <span title={team?.state ?? ""} className="ml-1.5 rounded border border-accent px-1 align-middle text-[10px] font-semibold text-accent">{tag}</span>;
}
