import os
root = os.environ.get("BB_ROOT", "/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-8")
base = os.path.join(root, "plugins/provider-claude-code/src")

p = os.path.join(base, 'bridge/commands.ts'); s = open(p).read()
old = '''  config: z.record(z.string(), z.unknown()).optional(),
  permissionEscalation: bridgePermissionEscalationSchema,
});

export const claudeTurnSteerParamsSchema = z.object({'''
new = '''  config: z.record(z.string(), z.unknown()).optional(),
  permissionEscalation: bridgePermissionEscalationSchema,
  // `/plan` on a later turn: the live session must switch into Plan mode
  // before the prompt is pushed. Undefined keeps the session's current mode.
  claudeCodePermissionMode: z.literal("plan").optional(),
});

export const claudeTurnSteerParamsSchema = z.object({'''
assert s.count(old) == 1
s = s.replace(old, new)
old = '''  providerSubagentsEnabled: z.boolean().optional(),
  permissionEscalation: bridgePermissionEscalationSchema,
});

/** The canonical Provider Bridge Protocol params, per method. */'''
new = '''  providerSubagentsEnabled: z.boolean().optional(),
  permissionEscalation: bridgePermissionEscalationSchema,
  claudeCodePermissionMode: z.literal("plan").optional(),
});

/** The canonical Provider Bridge Protocol params, per method. */'''
assert s.count(old) == 1
s = s.replace(old, new)
open(p, 'w').write(s)

p = os.path.join(base, 'session-params.ts'); s = open(p).read()
old = '''    providerSubagentsEnabled: providerOptions.providerSubagentsEnabled,
    permissionEscalation: args.options.permissionEscalation,
  };
}'''
new = '''    providerSubagentsEnabled: providerOptions.providerSubagentsEnabled,
    permissionEscalation: args.options.permissionEscalation,
    ...(providerOptions.claudeCodePermissionMode !== undefined
      ? { claudeCodePermissionMode: providerOptions.claudeCodePermissionMode }
      : {}),
  };
}'''
assert s.count(old) == 1
s = s.replace(old, new)
open(p, 'w').write(s)

p = os.path.join(base, 'bridge/bridge.ts'); s = open(p).read()
old = '''  try {
    await applyLiveSessionSettings(
      threadSession,
      params.threadId,
      withTurnLiveSessionSettings(threadSession.liveSettings, params),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(id, -32000, message);
    return;
  }
'''
new = '''  try {
    await applyLiveSessionSettings(
      threadSession,
      params.threadId,
      withTurnLiveSessionSettings(threadSession.liveSettings, params),
    );
    await enterPlanModeIfRequested(threadSession, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(id, -32000, message);
    return;
  }
'''
assert s.count(old) == 2, s.count(old)
s = s.replace(old, new)
anchor = '''function restoreApprovedPlanPermissionMode(threadSession: ThreadSession): void {'''
helper = '''/**
 * `/plan` on a later turn of a live session. Session construction used to be
 * the only place the permission mode was applied, so a mid-conversation
 * `/plan` stripped the mention and pushed the prompt into a session that was
 * still in the user's preset mode: no plan-mode reminder, no ExitPlanMode
 * proposal. Switch the live SDK session into Plan mode before the prompt is
 * pushed; the preset stays in `approvedPlanPermissionMode` for the approval
 * to restore.
 */
async function enterPlanModeIfRequested(
  threadSession: ThreadSession,
  params: TurnStartParams | TurnSteerParams,
): Promise<void> {
  if (
    params.claudeCodePermissionMode !== "plan" ||
    threadSession.permissionMode === "plan"
  ) {
    return;
  }
  threadSession.permissionMode = "plan";
  await threadSession.session.setPermissionMode("plan");
}

'''
assert s.count(anchor) == 1
s = s.replace(anchor, helper + anchor)
open(p, 'w').write(s)
print("applied")
