import { Alert, LinkButton, PageHeader } from "@/kernel/ui";

export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<{ permission?: string }> }) {
  const { permission } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Access denied" description="Your roles don't grant the permission required for this page." />
      <Alert tone="danger" title="Missing permission">
        <code className="font-mono text-xs">{permission ?? "unknown"}</code>
      </Alert>
      <div className="mt-4">
        <LinkButton href="/">Back to home</LinkButton>
      </div>
    </div>
  );
}
