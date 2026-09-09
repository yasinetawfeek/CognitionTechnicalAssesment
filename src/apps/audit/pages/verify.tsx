import { pageContext } from "@/kernel/context";
import { verifyAuditChain } from "@/kernel/audit";
import { db } from "@/kernel/db";
import { Alert, Card, CardBody, CardHeader, PageHeader, Stat } from "@/kernel/ui";

export const dynamic = "force-dynamic";

export default async function AuditVerifyPage() {
  await pageContext("kernel.audit.read", "/audit/verify");
  const started = Date.now();
  const [result, head] = await Promise.all([verifyAuditChain(), db.auditLog.findFirst({ orderBy: { seq: "desc" } })]);
  const ms = Date.now() - started;

  return (
    <>
      <PageHeader
        title="Chain integrity"
        description="Recomputes every hash from the genesis entry forward and compares it to the stored value. Runs on every page load."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Status" value={result.ok ? "Intact" : "BROKEN"} tone={result.ok ? "success" : "danger"} />
        <Stat label="Entries verified" value={result.checked} hint={`${ms} ms`} />
        <Stat label="Head sequence" value={head?.seq ?? 0} />
      </div>
      {result.ok ? (
        <Alert tone="success" title="Every entry is consistent with its predecessor.">
          Head hash: <span className="break-all font-mono text-xs">{head?.hash ?? "—"}</span>
        </Alert>
      ) : (
        <Alert tone="danger" title={`Chain broken at entry #${result.firstBrokenSeq}`}>
          The stored hash at this entry does not match the recomputed value. Everything after it is untrusted.
        </Alert>
      )}
      <Card className="mt-6">
        <CardHeader title="How it works" />
        <CardBody className="space-y-2 text-sm text-muted">
          <p>
            <code className="font-mono text-xs">hash = sha256(prevHash + canonicalJson(entry))</code>. The first entry chains from a genesis hash of
            64 zeroes.
          </p>
          <p>
            For production, periodically anchor the head hash somewhere external (an S3 object-lock bucket, a ticket, an email to compliance) so
            even a full database rewrite is detectable.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
