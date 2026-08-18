# Reverts apply-fix.py edits (keeps the render probes).
root='/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-2/'
import re
p=root+'apps/app/src/hooks/usePromptDraftStorage.ts'
s=open(p).read()
new='''export function getPromptDraftAccessor(scope: PromptDraftScope): {
  getCurrent: () => PromptDraftState;
  setDraft: (draft: PromptDraftState) => void;
} {
  const storageKey = getPromptDraftStorageKey(scope);
  return {
    getCurrent: () => readPromptDraft(storageKey),
    setDraft: (draft) => writePromptDraft(storageKey, draft),
  };
}'''
i=s.index('export function getPromptDraftAccessor'); j=s.index('export function usePromptDraftStorage')
s=s[:i]+new+'\n\n'+s[j:]; open(p,'w').write(s)
p=root+'apps/app/src/views/thread-detail/ThreadDetailView.tsx'
s=open(p).read()
s=s.replace('import { getPromptDraftAccessor } from "@/hooks/usePromptDraftStorage";','import { usePromptDraftStorage } from "@/hooks/usePromptDraftStorage";')
i=s.index('  // FIX (#1304 part A)'); j=s.index('  const addQuoteToComposer = selectionPromptDraft.addQuote;')
s=s[:i]+'''  const selectionPromptDraft = usePromptDraftStorage({
    kind: "thread",
    projectId: thread?.projectId ?? projectId ?? "",
    threadId: thread?.id ?? "",
  });
'''+s[j:]
i=s.index('  // FIX (#1304 part B)'); j=s.index('    [environment, threadEnvironmentIsLocal],\n  );\n', i)+len('    [environment, threadEnvironmentIsLocal],\n  );\n')
s=s[:i]+'''  const threadOpenContext = resolveEnvironmentOpenContext({
    environment,
    serverOrigin: window.location.origin,
    threadEnvironmentIsLocal,
  });
'''+s[j:]
open(p,'w').write(s); print("reverted")
