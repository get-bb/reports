import type { BbPluginApi } from "@get-bb/plugin-sdk";

declare const bb: BbPluginApi;
declare const projectId: string;

async function documentedExample(): Promise<void> {
  const { threads } = await bb.sdk.threads.list({ projectId, limit: 50 });
  console.log(threads);
}

void documentedExample;
