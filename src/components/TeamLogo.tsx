import type { Team } from "@/lib/tournament";
import { cn } from "@/lib/utils";

/** Team logo image with the 3-letter badge as fallback when no logo is set. */
export function TeamLogo({ team, className }: { team: Team | undefined; className?: string }) {
  if (!team) return null;
  if (team.logo_url) {
    return (
      <img
        src={team.logo_url}
        alt={team.name}
        className={cn("h-7 w-7 shrink-0 rounded-full border border-border bg-secondary object-contain", className)}
      />
    );
  }
  return (
    <span className={cn("inline-flex h-7 shrink-0 items-center justify-center rounded bg-secondary px-1.5 font-display text-sm", className)}>
      {team.short_name}
    </span>
  );
}
