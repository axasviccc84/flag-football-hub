import { Link, useRouterState } from "@tanstack/react-router";
import { parseCategory, useCategory } from "@/lib/tournament";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Posiciones" },
  { to: "/calendario", label: "Calendario" },
  { to: "/lideres", label: "Líderes" },
] as const;

export function SiteHeader() {
  const { pathname, search } = useRouterState({ select: (s) => s.location });
  const cat = parseCategory((search as Record<string, unknown>)["cat"]);
  const category = useCategory(cat);
  const branding = useBranding();
  const words = branding.name.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words.pop() : null;
  const isPublic = pathname === "/" || pathname === "/calendario" || pathname === "/lideres";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" search={{ cat }} className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-md" />
          <span className="font-display text-2xl leading-none">
            {lastWord ? <>{words.join(" ")} <span className="text-primary">{lastWord}</span></> : <span className="text-primary">{branding.name}</span>}
          </span>
        </Link>
        <div className="flex gap-2">
        <Link
          to="/planilla"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          Planilleros
        </Link>
        <Link
          to="/admin"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          Admin
        </Link>
        </div>
      </div>
      {isPublic && (
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {category.categories.map((c) => (
              <Link
                key={c.id}
                to={pathname as "/"}
                search={{ cat: c.id }}
                className={cn(
                  "min-w-[7rem] flex-1 whitespace-nowrap rounded-md px-3 py-2 text-center font-display text-lg transition-colors",
                  c.id === category.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>
          <nav className="mt-3 flex gap-6 border-b border-border">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                search={{ cat }}
                className={cn(
                  "-mb-px border-b-2 pb-2 text-sm font-semibold uppercase tracking-wider transition-colors",
                  pathname === n.to ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
