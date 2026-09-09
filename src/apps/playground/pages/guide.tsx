import { pageContext } from "@/kernel/context";
import { Card, CardBody, CardHeader, PageHeader } from "@/kernel/ui";

const steps: { title: string; body: string; code: string }[] = [
  {
    title: "1. Declare the app",
    body: "A manifest registers the app, its permissions, events and nav. The kernel adds <id>.access automatically and renders the sidebar.",
    code: `// src/apps/kyc/manifest.ts
export const kycApp = defineApp({
  id: "kyc", name: "KYC Review", icon: "UserCheck", category: "operations",
  permissions: [{ key: "kyc.case.decide", description: "Approve/reject a case" }],
  events: [{ type: "kyc.case.decided", description: "Case decision recorded" }],
  nav: [{ label: "Queue", path: "" }],
});`,
  },
  {
    title: "2. Add a page",
    body: "Pages are React Server Components. pageContext() enforces login + permission and gives you ctx.user / ctx.can / ctx.audit.",
    code: `// src/apps/kyc/pages/queue.tsx
export default async function Queue() {
  const ctx = await pageContext("kyc.case.read", "/kyc");
  const cases = await db.kycCase.findMany();
  return <><LiveRefresh patterns={["kyc.*"]} /><DataTable rows={cases} ... /></>;
}
// src/app/(shell)/kyc/page.tsx
export { default } from "@/apps/kyc/pages/queue";`,
  },
  {
    title: "3. Mutate with a server action",
    body: "action() wraps zod parsing, error mapping and revalidation. Audit + publish are one line each.",
    code: `export const decideAction = action(async (fd) => {
  const ctx = await requirePermission("kyc.case.decide");
  const { id, decision } = parseForm(schema, fd);
  await db.kycCase.update({ where: { id }, data: { decision } });
  await ctx.audit({ appId: "kyc", action: "case.decide", targetType: "KycCase", targetId: id, after: { decision } });
  await publish({ type: "kyc.case.decided", sourceAppId: "kyc", actorId: ctx.user.id, payload: { id, decision } });
  return { ok: true };
});`,
  },
  {
    title: "4. Need a second approver?",
    body: "requestApproval() creates an inbox item for anyone holding the required permission (excluding the requester). Your handler runs on approve.",
    code: `registerApprovalHandler("kyc.case.decide", {
  onApproved: async (req, ctx) => { /* apply req.payload */ },
});
await requestApproval(ctx, { appId: "kyc", type: "kyc.case.decide", title, payload, requiredPermission: "kyc.case.decide" });`,
  },
  {
    title: "5. ML / long-running work",
    body: "Register a job handler; the in-process worker runs it and publishes job.completed. Point it at a Python service for real models.",
    code: `registerJobHandler("kyc.score-case", async ({ caseId }) => {
  const res = await fetch(process.env.ML_URL + "/score", { method: "POST", body: JSON.stringify({ caseId }) });
  return res.json();
});
subscribe("kyc.case.created", "kyc.auto-score", (e) => enqueueJob("kyc.score-case", { caseId: e.payload.id }));`,
  },
  {
    title: "6. Feature flags across apps",
    body: "Server: isEnabled(key, user). Client: useFlag(key) — seeded from the server and refreshed over SSE when flag.* events fire, so a toggle in one app propagates everywhere.",
    code: `const enabled = useFlag("kyc.show-risk-score");
if (await isEnabled("kyc.new-queue", ctx.user)) { ... }`,
  },
];

export default async function GuidePage() {
  await pageContext(undefined, "/playground/guide");
  return (
    <>
      <PageHeader
        title="How to build an app"
        description="The Playground app is ~250 lines and uses every kernel primitive. Copy it, or run `npm run create-app <id>` for a stub. Full guide: docs/APP_AUTHORING.md."
      />
      <div className="space-y-4">
        {steps.map((s) => (
          <Card key={s.title}>
            <CardHeader title={s.title} description={s.body} />
            <CardBody>
              <pre className="overflow-x-auto rounded-md bg-bg p-3 font-mono text-xs leading-relaxed">{s.code}</pre>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
