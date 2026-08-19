export const meta = {
  name: "collect-1914",
  description: "Issue 1914 repro: one claude-code worker that hits a 429",
  phases: [{ title: "Collect", detail: "Single worker" }],
};
phase("Collect");
const out = await agent("Reply only with ok.", {
  provider: "claude-code",
  model: "claude-opus-5[1m]",
  reasoningLevel: "low",
  title: "1914 worker",
});
return out;
