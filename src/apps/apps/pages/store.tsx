import Link from "next/link";
import { pageContext } from "@/kernel/context";
import { Badge, Card, CardBody, Icon, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";
import { loadStore } from "../data";
import { AppCard } from "../components/app-card";

const CATEGORY_LABEL: Record<string, string> = { operations: "Operations", finance: "Finance", engineering: "Engineering", other: "Other" };
const CATEGORY_ORDER = ["operations", "finance", "engineering", "other"];

export default async function StorePage() {
  const ctx = await pageContext(undefined, "/apps/store");
  const { apps, pending } = await loadStore(ctx);
  const groups = CATEGORY_ORDER.map((c) => ({ category: c, apps: apps.filter((a) => a.category === c) })).filter((g) => g.apps.length);
  const installedCount = apps.filter((a) => a.installed).length;

  return (
    <>
      <LiveRefresh patterns={["app.*", "apprequest.*"]} />
      <PageHeader
        title="App Store"
        description={`${apps.length} apps available on the platform · ${installedCount} installed. Installing adds an app to My apps; who can open it is still decided by roles.`}
        actions={
          <Link href="/builder" className="text-sm underline">
            Can&apos;t find what you need? Request an app
          </Link>
        }
      />
      {groups.map((g) => (
        <section key={g.category} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABEL[g.category] ?? g.category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.apps.map((a) => (
              <AppCard key={a.id} app={a} mode="store" />
            ))}
          </div>
        </section>
      ))}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Coming soon · approved in App Builder</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <Card key={p.id} className="border-dashed">
                <CardBody>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon name="Rocket" className="h-5 w-5 text-muted" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <Badge tone="info">deploying</Badge>
                  </div>
                  <p className="text-sm text-muted">{p.purpose}</p>
                  <p className="mt-2 text-xs text-muted">
                    Approved <RelativeTime date={p.publishedAt ?? new Date()} /> ·{" "}
                    <Link href={`/builder/${p.id}`} className="underline">
                      build details
                    </Link>
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
