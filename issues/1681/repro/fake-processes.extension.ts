// Minimal stand-in for @aliou/pi-processes notification delivery.
// After the first agent turn ends, wait 5s (like `sleep 5; echo done`) and send
// the same custom message shape pi-processes sends for attention:"turn":
//   pi.sendMessage({customType:"ad-process:notification", content:<string>, display:true, details},
//                  {triggerTurn:true, deliverAs:"steer"})
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let fired = false;
  pi.on("agent_end", async () => {
    if (fired) return;
    fired = true;
    setTimeout(() => {
      const details = {
        kind: "success",
        processId: "proc_551c",
        processName: "sleep-done",
        command: "sleep 5; echo done",
        timestamp: Date.now(),
        summary: "Process completed successfully",
        attention: "turn",
      };
      pi.sendMessage(
        {
          customType: "ad-process:notification",
          content:
            '<process_event type="lifecycle" kind="success" process_id="proc_551c" name="sleep-done">Process completed successfully: sleep 5; echo done</process_event>',
          display: true,
          details,
        },
        { triggerTurn: true, deliverAs: "steer" },
      );
    }, 5000);
  });
}
