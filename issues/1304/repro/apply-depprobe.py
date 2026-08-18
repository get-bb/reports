p='/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-2/apps/app/src/views/thread-detail/ThreadDetailView.tsx'
s=open(p).read()
anchor='  const workspaceMarkdownLinkRouting = useMemo('
probe='''  // #1304 investigation probe: which deps of getLocalFileContextMenuItems change identity per render
  {
    const w = window as unknown as { __bbDepPrev?: Record<string, unknown>; __bbDepChanges?: Record<string, number> };
    const cur: Record<string, unknown> = { threadOpenContext, fileOpenTargets, openPathInFileTarget, handleOpenTimelineLocalFileLink, pluginFileOpeners, getLocalFileContextMenuItems, workspaceOpenTargetsLen: fileOpenTargets.length };
    const prev = w.__bbDepPrev;
    if (prev) { w.__bbDepChanges ??= {}; for (const k of Object.keys(cur)) if (!Object.is(prev[k], cur[k])) w.__bbDepChanges[k] = (w.__bbDepChanges[k] ?? 0) + 1; }
    w.__bbDepPrev = cur;
  }
'''
assert anchor in s and probe not in s
s=s.replace(anchor, probe+anchor,1)
open(p,'w').write(s)
print("ok")
