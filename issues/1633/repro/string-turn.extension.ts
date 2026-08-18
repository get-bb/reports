// Repro extension for get-bb/bb#1633.
// After the first client-started turn ends, wait 4s (agent idle) and then
// start an extension-triggered turn with a STRING-content custom message,
// exactly like pi-processes does with onSuccess: "turn".
export default function (pi: any) {
  let fired = false;
  pi.on("agent_end", async () => {
    if (fired) return;
    fired = true;
    setTimeout(() => {
      pi.sendMessage(
        {
          customType: "pi-processes",
          content: "Process completed successfully. Reply only with: done",
          display: true,
        },
        { triggerTurn: true, deliverAs: "steer" },
      );
    }, 4000);
  });
}
