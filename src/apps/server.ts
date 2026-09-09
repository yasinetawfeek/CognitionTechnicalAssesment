/**
 * Server-side app hooks: event subscribers, approval handlers, job handlers.
 * Imported once at boot from src/instrumentation.ts. Add your app's `server.ts` here.
 */
export async function registerAppServerHooks() {
  await import("./playground/server");
  await import("./builder/server");
}
