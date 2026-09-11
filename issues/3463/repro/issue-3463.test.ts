import { expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createConnection } from "../../src/connection.js";
import { migrate } from "../../src/migrate.js";
import { noopNotifier } from "../../src/notifier.js";
import { createProject } from "../../src/data/projects.js";
import { upsertHost } from "../../src/data/hosts.js";
import { getProjectExecutionDefaults, upsertProjectExecutionDefaults } from "../../src/data/project-execution-defaults.js";
import { projectExecutionDefaults } from "../../src/schema.js";

it("retains the first provider settings after remembering a second provider", () => {
  const db = createConnection(":memory:");
  try {
    migrate(db);
    const host = upsertHost(db, noopNotifier, { name: "repro-host", type: "persistent" });
    const { project } = createProject(db, noopNotifier, {
      name: "repro-project",
      source: { type: "local_path", hostId: host.id, path: "/tmp/repro-project" },
    });
    for (const [providerId, model] of [["provider-one", "model-one"], ["provider-two", "model-two"]]) {
      upsertProjectExecutionDefaults(db, {
        projectId: project.id, providerId, model,
        reasoningLevel: "high", permissionMode: "full", serviceTier: "default",
      });
    }
    expect(getProjectExecutionDefaults(db, { projectId: project.id })?.providerId).toBe("provider-two");
    const rows = db.select({ providerId: projectExecutionDefaults.providerId, model: projectExecutionDefaults.model })
      .from(projectExecutionDefaults).where(eq(projectExecutionDefaults.projectId, project.id)).all();
    console.log("Remembered provider rows:", JSON.stringify(rows));
    expect(rows).toEqual(expect.arrayContaining([{ providerId: "provider-one", model: "model-one" }]));
  } finally {
    db.$client.close();
  }
});
