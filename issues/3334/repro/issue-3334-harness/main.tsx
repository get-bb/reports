import React from "react";
import { createRoot } from "react-dom/client";
import { ThreadContextWindowIndicator } from "../src/components/thread/timeline/ThreadContextWindowIndicator";
import "../src/components/ui/theme.css";

createRoot(document.getElementById("root")!).render(
  <main style={{ padding: 24 }}>
    <h1>Trusted context indicator</h1>
    <p>Isolated real component; synthetic usage data.</p>
    <div style={{ position: "fixed", bottom: 48, right: 32 }}>
      <ThreadContextWindowIndicator usage={{ usedTokens: 25000, modelContextWindow: 100000, estimated: false }} />
    </div>
  </main>,
);
