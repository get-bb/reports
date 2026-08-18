# Applies the proposed fix for #1304 to the worktree (run from anywhere):
#  A) getPromptDraftAccessor gains addQuote + storageKey; ThreadDetailViewInternal
#     uses it instead of usePromptDraftStorage (no per-keystroke subscription).
#  B) useLocalOpenTargets memoizes openContext structurally, so callers that
#     rebuild an equal context object each render (ThreadDetailView's
#     resolveEnvironmentOpenContext) get stable callbacks and the
#     MarkdownLocalFileContextMenuContext value stays referentially stable.
root='/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-2/'
p=root+'apps/app/src/hooks/usePromptDraftStorage.ts'
s=open(p).read()
old='''export function getPromptDraftAccessor(scope: PromptDraftScope): {
  getCurrent: () => PromptDraftState;
  setDraft: (draft: PromptDraftState) => void;
} {
  const storageKey = getPromptDraftStorageKey(scope);
  return {
    getCurrent: () => readPromptDraft(storageKey),
    setDraft: (draft) => writePromptDraft(storageKey, draft),
  };
}'''
new='''export function getPromptDraftAccessor(scope: PromptDraftScope): {
  storageKey: string;
  getCurrent: () => PromptDraftState;
  setDraft: (draft: PromptDraftState) => void;
  addQuote: (
    text: string,
    attachments?: readonly PromptDraftAttachment[],
  ) => void;
} {
  const storageKey = getPromptDraftStorageKey(scope);
  return {
    storageKey,
    getCurrent: () => readPromptDraft(storageKey),
    setDraft: (draft) => writePromptDraft(storageKey, draft),
    addQuote: (text, attachments = []) => {
      const currentDraft = readPromptDraft(storageKey);
      const nextDraft = appendQuoteAndAttachmentsToDraft(
        currentDraft,
        text,
        attachments,
      );
      // Whitespace-only text with no new attachments is a no-op.
      if (nextDraft === currentDraft) return;
      writePromptDraft(storageKey, nextDraft);
    },
  };
}'''
assert old in s; s=s.replace(old,new,1); open(p,'w').write(s)

p=root+'apps/app/src/views/thread-detail/ThreadDetailView.tsx'
s=open(p).read()
old='import { usePromptDraftStorage } from "@/hooks/usePromptDraftStorage";'
new='import { getPromptDraftAccessor } from "@/hooks/usePromptDraftStorage";'
assert old in s; s=s.replace(old,new,1)
old='''  const selectionPromptDraft = usePromptDraftStorage({
    kind: "thread",
    projectId: thread?.projectId ?? projectId ?? "",
    threadId: thread?.id ?? "",
  });
  const addQuoteToComposer = selectionPromptDraft.addQuote;'''
new='''  // FIX (#1304 part A): this view never renders the draft; it only needs
  // event-time access (addQuote) and the storage key. Subscribing via
  // usePromptDraftStorage re-rendered the whole thread view on every keystroke.
  const selectionPromptDraftProjectId = thread?.projectId ?? projectId ?? "";
  const selectionPromptDraftThreadId = thread?.id ?? "";
  const selectionPromptDraft = useMemo(
    () =>
      getPromptDraftAccessor({
        kind: "thread",
        projectId: selectionPromptDraftProjectId,
        threadId: selectionPromptDraftThreadId,
      }),
    [selectionPromptDraftProjectId, selectionPromptDraftThreadId],
  );
  const addQuoteToComposer = selectionPromptDraft.addQuote;'''
assert old in s; s=s.replace(old,new,1)
open(p,'w').write(s)

p=root+'apps/app/src/hooks/useLocalOpenTargets.ts'
s=open(p).read()
old='''  const openContext = useMemo<OpenInTargetContext>(
    () => args.openContext ?? { kind: "local" },
    [args.openContext],
  );'''
new='''  // FIX (#1304 part B): memoize structurally. Callers (ThreadDetailView)
  // rebuild an equal context object on every render; keying on identity made
  // every callback below — and the timeline-wide context value built from
  // them — change identity per render.
  const openContextKind = args.openContext?.kind ?? "local";
  const openContextHostId =
    args.openContext?.kind === "remote-ssh" ? args.openContext.hostId : null;
  const openContextServerOrigin =
    args.openContext?.kind === "remote-ssh"
      ? args.openContext.serverOrigin
      : null;
  const openContext = useMemo<OpenInTargetContext>(
    () =>
      openContextKind === "remote-ssh" &&
      openContextHostId !== null &&
      openContextServerOrigin !== null
        ? {
            kind: "remote-ssh",
            hostId: openContextHostId,
            serverOrigin: openContextServerOrigin,
          }
        : { kind: "local" },
    [openContextHostId, openContextKind, openContextServerOrigin],
  );'''
assert old in s; s=s.replace(old,new,1); open(p,'w').write(s)
print("fix applied")
