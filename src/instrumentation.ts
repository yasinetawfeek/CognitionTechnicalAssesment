/**
 * Next.js boot hook. Registers app server hooks (event subscribers, approval + job handlers) and
 * starts the in-process job worker. The `NEXT_RUNTIME` guard lets the bundler drop the Node-only
 * imports from the edge build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerAppServerHooks } = await import("@/apps/server");
    const { startJobWorker } = await import("@/kernel/jobs");
    await registerAppServerHooks();
    if (process.env.KERNEL_DISABLE_WORKER !== "true") startJobWorker();
  }
}
