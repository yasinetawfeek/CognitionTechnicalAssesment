import Link from "next/link";
import { pageContext } from "@/kernel/context";
import { installedAppIds } from "@/kernel/apps/installs";
import { Alert, buttonClass, EmptyState, LiveRefresh, PageHeader } from "@/kernel/ui";
import { loadStore } from "../data";
import { AppCard } from "../components/app-card";

export default async function MyAppsPage() {
  const ctx = await pageContext(undefined, "/apps");
  const [{ apps }, order] = await Promise.all([loadStore(ctx), installedAppIds(ctx.user.id)]);
  const mine = order.map((id) => apps.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  const lostAccess = mine.filter((a) => !a.available);

  return (
    <>
      <LiveRefresh patterns={["app.*"]} />
      <PageHeader
        title="My apps"
        description="Apps you have installed. Open them from here, or browse the App Store to add more."
        actions={
          <Link href="/apps/store" className={buttonClass("secondary", "sm")}>
            Browse App Store
          </Link>
        }
      />
      {lostAccess.length > 0 && (
        <Alert tone="warning" title="Some installed apps are no longer available to you">
          {lostAccess.map((a) => a.name).join(", ")} — your roles changed or a feature flag turned them off. Ask an admin or uninstall them.
        </Alert>
      )}
      {mine.length === 0 ? (
        <EmptyState
          title="No apps installed yet"
          description="Pick the tools you need from the App Store — they will show up here."
          action={
            <Link href="/apps/store" className={buttonClass("primary")}>
              Open the App Store
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((a) => (
            <AppCard key={a.id} app={a} mode="mine" />
          ))}
        </div>
      )}
    </>
  );
}
