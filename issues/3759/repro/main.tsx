import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AutoHeightContainer } from "../src/components/ui/height-transition";
import { BottomAnchoredScrollBody } from "../src/components/ui/bottom-anchored-scroll-body";
function Repro() {
 const [count, setCount] = useState(24);
 return <><h1>Timeline height growth probe</h1><p>Real AutoHeightContainer and BottomAnchoredScrollBody; synthetic rows.</p><button onClick={() => setCount(n => n + 1)}>Append row</button><section><BottomAnchoredScrollBody footer={null} maxWidthClassName="probe-content"><AutoHeightContainer><div data-timeline-row-list="top-level">{Array.from({length:count}, (_, i) => <div className="row" data-timeline-row-id={`row-${i}`} key={i}>Timeline row {i + 1}</div>)}</div></AutoHeightContainer></BottomAnchoredScrollBody></section></>;
}
createRoot(document.getElementById("root")!).render(<Repro />);
