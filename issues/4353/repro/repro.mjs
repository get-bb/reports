import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2]);
const { buildFollowUpSubmitMode, canSubmitFollowUpShortcut } = await import(pathToFileURL(resolve(root, "packages/client-core/src/prompt/threadDetailPromptSubmission.ts")));
const source = readFileSync(resolve(root, "apps/app/src/components/promptbox/FollowUpPromptBox.tsx"), "utf8");
const primary = source.match(/const steerOnPrimarySubmit =\s*([^;]+);/)[1];
const disabled = source.match(/disabled:\s*(!canSubmit\s*\|\|[\s\S]*?),\s*onModifierSubmit,/)[1];
let failures = 0;
for (const status of ["active", "host-reconnecting", "waiting-for-host"]) {
  const submitMode = buildFollowUpSubmitMode({
    hasPendingInteraction: false,
    isDefaultExecutionOptionsLoading: false,
    isPendingInteractionsInitialLoading: false,
    isStopRequested: false,
    onStop() {},
    runtimeDisplayStatus: status,
  });
  const composer = {
    steerActiveThreadOnEnter: true,
    isFollowUpSubmitting: false,
    canModifierSubmit: canSubmitFollowUpShortcut({
      hasPromptDraftInput: true,
      isFollowUpSubmitting: false,
      isQueueMutationPending: false,
      queuedMessageCount: 0,
      runtimeDisplayStatus: status,
      submitModeKind: submitMode.kind,
    }),
  };
  const steerOnPrimarySubmit = Function("submitMode", "composer", "return (" + primary + ")")(submitMode, composer);
  const blocked = Function("canSubmit", "composer", "steerOnPrimarySubmit", "return (" + disabled + ")")(true, composer, steerOnPrimarySubmit);
  console.log(JSON.stringify({status, mode: submitMode.kind, canSteer: composer.canModifierSubmit, disabled: blocked}));
  try { assert.equal(blocked, false, status + " should allow submission"); }
  catch (error) { failures++; console.log(error.message); }
}
assert.equal(failures, 0, "All runtime states should retain a submit path");
