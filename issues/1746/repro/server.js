import { EventEmitter } from "node:events";

// Mimics an ImapFlow client created without an 'error' listener: the socket
// timeout fires from a timer on a later tick, and Node rethrows an unlistened
// 'error' event as an uncaught exception.
export default function (bb) {
  bb.background.service("imap-poller", {
    async start(signal) {
      bb.log.info("imap-poller started; will emit unhandled 'error' in 3s");
      const client = new EventEmitter(); // no client.on("error", ...) — the bug
      setTimeout(() => {
        client.emit("error", new Error("Socket timeout"));
      }, 3_000);
      // The service itself never rejects: it just waits for abort.
      await new Promise((resolve) => signal.addEventListener("abort", resolve));
    },
  });
}
