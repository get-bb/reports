import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const skillPath = fileURLToPath(
  new URL(
    "../../src/services/skills/builtin-skills/submit-a-plugin/SKILL.md",
    import.meta.url,
  ),
);
const schemaPath = fileURLToPath(
  new URL("../../../web/public/schemas/marketplace.schema.json", import.meta.url),
);

describe("submit-a-plugin marketplace entry example", () => {
  it("conforms to the published marketplace schema", async () => {
    const skill = await readFile(skillPath, "utf8");
    const marker = "Use this shape as a guide. Confirm every field against the current schema.";
    const markerIndex = skill.indexOf(marker);
    if (markerIndex < 0) throw new Error("entry example marker is missing");

    const match = /```json\n([\s\S]*?)\n```/u.exec(skill.slice(markerIndex));
    if (match?.[1] === undefined) throw new Error("entry JSON example is missing");
    const entry = JSON.parse(match[1]);

    const schema = z.record(z.string(), z.unknown()).parse(
      JSON.parse(await readFile(schemaPath, "utf8")),
    );
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const manifest = {
      schemaVersion: 1,
      name: "example",
      displayName: "Example plugins",
      plugins: [entry],
    };

    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
  });
});
