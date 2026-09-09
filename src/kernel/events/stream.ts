import { addStreamListener, eventMatches, type KernelEvent } from "./bus";

/**
 * Server-Sent Events response that forwards matching kernel events to a browser.
 * Used by /api/kernel/events/stream. Payloads are only forwarded for event types the
 * caller is allowed to see (see the route handler for the permission filter).
 */
export function createEventStreamResponse(opts: {
  patterns: string[];
  filter?: (event: KernelEvent) => boolean;
  signal: AbortSignal;
}): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (name: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("ready", { patterns: opts.patterns, at: new Date().toISOString() });

      const remove = addStreamListener((event) => {
        if (!opts.patterns.some((p) => eventMatches(p, event.type))) return;
        if (opts.filter && !opts.filter(event)) return;
        send("kernel", {
          id: event.id,
          type: event.type,
          sourceAppId: event.sourceAppId,
          payload: event.payload,
          createdAt: event.createdAt,
        });
      });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          /* closed */
        }
      }, 25_000);

      cleanup = () => {
        clearInterval(heartbeat);
        remove();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      opts.signal.addEventListener("abort", () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
