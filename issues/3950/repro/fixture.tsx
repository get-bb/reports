import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ComposerEditorSlot } from './src/components/promptbox/ComposerEditorSlot';
function Fixture() {
  const ref = useRef<HTMLDivElement>(null);
  const layout = new URLSearchParams(location.search).get('layout') === 'thread' ? 'thread' : 'root-compose';
  const editor = useEditor({extensions:[StarterKit],content: Array.from({length:30},(_,i)=>`<p>Draft line ${i+1} — sizing probe</p>`).join('')});
  return <><h1>Actual ComposerEditorSlot • {layout}</h1><p>Isolated component probe. Dashed line = synthetic 400px shell boundary. No iOS keyboard is running.</p><div id="boundary"/><section><ComposerEditorSlot editor={editor} scrollContainerRef={ref} inputLocked={false} isCompactLayout={false} minHeight={48} layout={layout} resolveMentionLink={undefined}/><footer>Fixture footer (not BB toolbar)</footer></section></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
