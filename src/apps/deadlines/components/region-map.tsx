import Link from "next/link";
import { cn, type Tone } from "@/kernel/ui";
import { countryToRegion, REGIONS, regionLabel } from "../regions";
import { COUNTRY_PATHS, MAP_HEIGHT, MAP_NORTH, MAP_WIDTH } from "../world-map.generated";

/** Same equirectangular projection the outlines were generated with. */
function project(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * MAP_WIDTH, ((MAP_NORTH - lat) / 360) * MAP_WIDTH];
}

export type RegionSummary = { key: string; total: number; overdue: number; dueSoon: number; tone: Tone };

const fills: Record<Tone, string> = {
  neutral: "fill-black/20",
  success: "fill-success",
  warning: "fill-warning",
  danger: "fill-danger",
  info: "fill-info",
  primary: "fill-primary",
};

const strokes: Record<Tone, string> = {
  neutral: "stroke-black/20",
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
  info: "stroke-info",
  primary: "stroke-primary",
};

const dots: Record<Tone, string> = {
  neutral: "bg-black/20",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  primary: "bg-primary",
};

export function RegionMap({ summaries, selected }: { summaries: RegionSummary[]; selected?: string }) {
  const byRegion = new Map(summaries.map((s) => [s.key, s]));
  const regionOf = countryToRegion(byRegion.keys());
  const href = (key: string) => (selected === key ? "/deadlines/map" : `/deadlines/map?region=${key}`);
  const global = byRegion.get("GLOBAL");

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-surface p-2">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Deadlines by region" className="w-full">
          {Object.entries(COUNTRY_PATHS).map(([code, d]) => {
            const region = regionOf.get(code);
            const summary = region ? byRegion.get(region) : undefined;
            const shape = (
              <path
                d={d}
                className={cn(
                  "stroke-white/70 [stroke-width:0.4]",
                  summary ? fills[summary.tone] : "fill-black/[0.08]",
                  summary && (selected && selected !== region ? "opacity-40" : "hover:opacity-80"),
                )}
              />
            );
            if (!region || !summary) return <g key={code}>{shape}</g>;
            return (
              <Link key={code} href={href(region)}>
                <title>{`${regionLabel(region)} — ${summary.total} open`}</title>
                {shape}
              </Link>
            );
          })}
          {REGIONS.filter((r) => r.pin && byRegion.has(r.key)).map((region) => {
            const summary = byRegion.get(region.key)!;
            const [x, y] = project(region.pin!.lon, region.pin!.lat);
            return (
              <Link key={region.key} href={href(region.key)}>
                <title>{`${region.label} — ${summary.total} open`}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={4}
                  className={cn(
                    "[stroke-width:1.5] fill-white",
                    strokes[summary.tone],
                    selected && selected !== region.key ? "opacity-40" : "hover:opacity-80",
                  )}
                />
                <circle cx={x} cy={y} r={2} className={fills[summary.tone]} />
              </Link>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2">
        {REGIONS.filter((r) => byRegion.has(r.key)).map((region) => {
          const summary = byRegion.get(region.key)!;
          return (
            <Link
              key={region.key}
              href={href(region.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                selected === region.key ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:bg-black/[0.03]",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", dots[summary.tone])} />
              {region.label}
              <span className="tabular-nums">{summary.total}</span>
            </Link>
          );
        })}
      </div>
      {global && (
        <p className="text-xs text-muted">
          {global.total} group-wide {global.total === 1 ? "deadline applies" : "deadlines apply"} to every jurisdiction, so they are not
          shaded on the map — use the Group-wide filter above.
        </p>
      )}
    </div>
  );
}
