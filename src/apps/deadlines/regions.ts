/**
 * Jurisdictions a deadline can belong to. Each region maps onto the ISO 3166-1 alpha-2 codes
 * used by the generated world map, so a region covering several countries (the EU, Nordics)
 * highlights all of them.
 */
export type Region = {
  key: string;
  label: string;
  /** Countries shaded on the map. Empty for GLOBAL, which applies everywhere. */
  countries: string[];
  /** City-states are too small to shade at this scale, so they get a pin instead. */
  pin?: { lon: number; lat: number };
};

export const REGIONS: Region[] = [
  { key: "GLOBAL", label: "Group-wide", countries: [] },
  { key: "UK", label: "United Kingdom", countries: ["GB"] },
  { key: "IE", label: "Ireland", countries: ["IE"] },
  { key: "EU", label: "European Union", countries: ["DE", "FR", "NL", "BE", "LU", "IE", "IT", "ES", "PT", "AT", "PL", "SE", "DK", "FI", "CZ", "GR", "RO", "HU"] },
  { key: "NORDICS", label: "Nordics", countries: ["SE", "NO", "DK", "FI", "IS"] },
  { key: "US", label: "United States", countries: ["US"] },
  { key: "CA", label: "Canada", countries: ["CA"] },
  { key: "LATAM", label: "Latin America", countries: ["BR", "MX", "AR", "CL", "CO", "PE"] },
  { key: "UAE", label: "United Arab Emirates", countries: ["AE"] },
  { key: "ZA", label: "South Africa", countries: ["ZA"] },
  { key: "SG", label: "Singapore", countries: [], pin: { lon: 103.8, lat: 1.35 } },
  { key: "HK", label: "Hong Kong", countries: [], pin: { lon: 114.17, lat: 22.3 } },
  { key: "JP", label: "Japan", countries: ["JP"] },
  { key: "IN", label: "India", countries: ["IN"] },
  { key: "AU", label: "Australia & NZ", countries: ["AU", "NZ"] },
];

export const REGION_KEYS = REGIONS.map((r) => r.key) as [string, ...string[]];

const BY_KEY = new Map(REGIONS.map((r) => [r.key, r]));

export function regionLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

export function regionCountries(key: string): string[] {
  return BY_KEY.get(key)?.countries ?? [];
}

export function regionPin(key: string): { lon: number; lat: number } | undefined {
  return BY_KEY.get(key)?.pin;
}

/**
 * Region key for each country on the map. The first region claiming a country wins, and REGIONS
 * lists single-country regions before the blocs containing them (Ireland resolves to IE, not EU).
 */
export function countryToRegion(regionKeys: Iterable<string>): Map<string, string> {
  const wanted = new Set(regionKeys);
  const map = new Map<string, string>();
  for (const region of REGIONS) {
    if (!wanted.has(region.key)) continue;
    for (const country of region.countries) {
      if (!map.has(country)) map.set(country, region.key);
    }
  }
  return map;
}
