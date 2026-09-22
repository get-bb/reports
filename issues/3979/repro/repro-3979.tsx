import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle} from 'react-resizable-panels';
import {BottomAnchoredScrollBody} from './src/components/ui/bottom-anchored-scroll-body';
import './src/components/ui/theme.css';
function App() {
 const panel = useRef<ImperativePanelHandle>(null);
 const [open, setOpen] = useState(false);
 return <div className="flex h-screen flex-col bg-background text-foreground"><button onClick={() => {if(open) panel.current?.collapse(); else panel.current?.expand(); setOpen(!open);}}>Toggle right panel: {open ? 'open' : 'closed'}</button><PanelGroup direction="horizontal" className="min-h-0 flex-1" style={{overflow:'clip'}}><Panel defaultSize={100} minSize={20} className="min-w-0 overflow-clip"><div className="flex h-full min-h-0 flex-col"><BottomAnchoredScrollBody footer={<div className="bg-background p-4">Composer fixture</div>} maxWidthClassName="max-w-3xl" scrollAnchorThreadId="repro-3979"><div data-timeline-row-list="top-level">{Array.from({length:100}, (_,i) => <div key={i} data-timeline-row-id={`row-${i}`} className="p-4">Message {i+1}: synthetic conversation content for native scrolling verification. This line wraps as the adjacent panel opens and closes.</div>)}</div></BottomAnchoredScrollBody></div></Panel><PanelResizeHandle className={open ? 'w-px' : 'pointer-events-none w-0'} disabled={!open}/><Panel ref={panel} defaultSize={0} collapsible collapsedSize={0} minSize={25} className="overflow-clip"><div className="p-4">Right panel fixture</div></Panel></PanelGroup></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
