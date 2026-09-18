import React from "react";
import { createRoot } from "react-dom/client";
import { ThreadStatusGlyph } from "./src/components/thread/ThreadStatusGlyph";
import "./src/app.css";

createRoot(document.getElementById("root")!).render(
  <main style={{ padding: 40, fontFamily: "sans-serif" }}>
    <h1>Runtime glyph reproduction</h1>
    <p>Actual ThreadStatusGlyph and application CSS. Reduced motion is emulated by the browser.</p>
    <div id="glyph" style={{ margin: 30 }}>
      <ThreadStatusGlyph
        hasPendingInteraction={false} hasUnsubmittedDraft={false}
        hasUnreadError={false} hasUnreadSuccess={false}
        isBackgroundAgentActive={false} isBackgroundCommandActive={false}
        isGoalActive={false} isPlanModeActive={false}
        isRuntimeActive={true} isWorkflowActive={false} queuedWork={null}
      />
    </div>
    <pre id="result" />
  </main>,
);
