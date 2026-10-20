import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CompactViewportOverrideProvider } from "@bb/shared-ui/hooks/use-compact-viewport";
import { TooltipProvider } from "@bb/shared-ui/tooltip";
import { Sidebar, SidebarCollapsibleBody, SidebarFooter, SidebarProvider, SidebarTrigger } from "./src/components/ui/sidebar";
import "./src/app.css";

function Reproduction() {
  const [expanded, setExpanded] = useState(false);
  const [clicks, setClicks] = useState(0);
  const framed = new URLSearchParams(location.search).has("framed");
  return (
    <CompactViewportOverrideProvider isCompactViewport={false}>
      <TooltipProvider>
        <SidebarProvider defaultOpen collapsedRailWidth="52px" width="320px" framed={framed}>
          <Sidebar>
            <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto]">
              <div style={{ width: 52, gridRow: "1 / 3", padding: 8 }}>Rail</div>
              <SidebarCollapsibleBody className="col-start-2 row-start-1">
                <div style={{ padding: 16 }}>Synthetic sidebar content</div>
              </SidebarCollapsibleBody>
              <SidebarCollapsibleBody
                data-testid="footer-body"
                contentInFlow
                className={framed ? "col-start-2 row-start-2 rounded-tl-none border-t-0 [clip-path:inset(0_-6px_0_0_round_0_0_0_var(--bb-frame-card-radius))]" : "col-start-2 row-start-2"}
              >
                <SidebarFooter>
                  <div style={{ position: "relative", padding: 12 }}>
                    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Open footer card</button>
                    {expanded && <button data-testid="card" type="button" style={{ position: "absolute", bottom: "100%", marginBottom: 12, left: 8, width: 220, height: 120, background: "var(--background)", border: "2px solid var(--foreground)", zIndex: 100 }} onClick={() => setClicks(clicks + 1)}>Card action</button>}
                  </div>
                </SidebarFooter>
              </SidebarCollapsibleBody>
            </div>
          </Sidebar>
          <main style={{ padding: 32 }}>
            <h1>Footer overflow hit-test</h1>
            <p>Open the footer card, then click its action.</p>
            <output data-testid="clicks">Card clicks: {clicks}</output>
            <SidebarTrigger />
          </main>
        </SidebarProvider>
      </TooltipProvider>
    </CompactViewportOverrideProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Reproduction />);
