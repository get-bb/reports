// Live probe for get-bb/bb#1587: call the real daemon transcription path
// (transcribeCodexVoice) with the local codex ChatGPT subscription auth,
// N times, and report each outcome.
import fs from "node:fs";
import { transcribeCodexVoice } from "./src/codex-chatgpt-client.js";

const file = process.argv[2] ?? "/tmp/bb-reports/issues/1587/repro/tone.mp3";
const attempts = Number(process.argv[3] ?? "5");
const audioBase64 = fs.readFileSync(file).toString("base64");

for (let i = 1; i <= attempts; i++) {
  const started = performance.now();
  try {
    const result = await transcribeCodexVoice({
      type: "codex.voice.transcribe",
      model: "gpt-transcribe",
      audioBase64,
      mimeType: "audio/mpeg",
      filename: "tone.mp3",
      prompt: null,
      timeoutMs: 10_000,
    });
    console.log(
      `#${i} OK ${(performance.now() - started).toFixed(0)}ms text=${JSON.stringify(result.text)}`,
    );
  } catch (error) {
    const e = error as { code?: string; message?: string };
    console.log(
      `#${i} FAIL ${(performance.now() - started).toFixed(0)}ms code=${e.code} message=${e.message}`,
    );
  }
}
