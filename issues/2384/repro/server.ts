import { existsSync } from "node:fs";
import { z } from "zod";
import type { BbPluginApi } from "@get-bb/plugin-sdk";

const marker = "/tmp/bb-report-2384-tool-enabled";

export default function plugin(bb: BbPluginApi) {
  bb.agents.registerTool({
    name: "dynamic_tool_resume_probe",
    description: "Return a fixed generic probe result.",
    parameters: z.object({}).strict(),
    async execute() {
      return "DYNAMIC_TOOL_RESUME_OK";
    },
  });

  bb.agents.configure(() => ({
    tools: existsSync(marker) ? ["dynamic_tool_resume_probe"] : [],
    skills: [],
  }));
}
