import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WaveformVisualizer } from "./src/components/promptbox/WaveformVisualizer";

function Harness() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gain, setGain] = useState<GainNode | null>(null);
  const [level, setLevel] = useState("not started");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <main>
      <h1>Waveform input-level reproduction · #6396</h1>
      <p>Isolated production component with real Web Audio, not a transcription session.</p>
      <p>Reduced motion: <strong>{String(reduced)}</strong> · Synthetic input: <strong>{level}</strong></p>
      <button onClick={async () => {
        const context = new AudioContext();
        await context.resume();
        const oscillator = context.createOscillator();
        const volume = context.createGain();
        const destination = context.createMediaStreamDestination();
        oscillator.frequency.value = 220;
        volume.gain.value = 0;
        oscillator.connect(volume);
        volume.connect(destination);
        oscillator.start();
        setGain(volume);
        setStream(destination.stream);
        setLevel("silence");
      }}>Start synthetic input</button>
      <button disabled={!gain} onClick={() => { if (gain) gain.gain.value = 0; setLevel("silence"); }}>Silence</button>
      <button disabled={!gain} onClick={() => { if (gain) gain.gain.value = 0.1; setLevel("220 Hz signal"); }}>Signal</button>
      <section><WaveformVisualizer active stream={stream} /></section>
      <p>Expected: signal changes bar height. Actual on baseline with reduced motion: unchanged idle bars.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
