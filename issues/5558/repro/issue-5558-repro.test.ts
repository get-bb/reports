import { describe, expect, it } from "vitest";
import { machineGitHealth, resolveGitCredentials } from "./git-credentials.js";

describe("automatic GitHub credentials preserve authenticated identities", () => {
  it.each([
    { login: "synthetic-user", email: null },
    { login: "synthetic-user", email: "synthetic@example.com" },
    { login: "synthetic_user", email: null },
    { login: "synthetic_user", email: "synthetic@example.com" },
  ])(
    "forwards credentials for $login with email $email",
    async ({ login, email }) => {
      const successfulCommands: string[] = [];
      const run = async (args: string[]) => {
        if (args.join(" ") === "auth token --hostname github.com") {
          successfulCommands.push("token lookup succeeded");
          return "synthetic-credential\n";
        }
        if (args.join(" ") === "api --hostname github.com user") {
          successfulCommands.push("identity lookup succeeded");
          return JSON.stringify({ login, id: 4242, email });
        }
        throw new Error("Unexpected credential lookup command");
      };
      const entries = await resolveGitCredentials(run);
      const health = await machineGitHealth(run);
      expect(successfulCommands).toEqual([
        "token lookup succeeded",
        "identity lookup succeeded",
        "token lookup succeeded",
        "identity lookup succeeded",
      ]);
      expect.soft(health.status).toBe("ready");
      expect.soft(entries.map((entry) => entry.name)).toContain("GH_TOKEN");
      expect
        .soft(entries.find((entry) => entry.name === "GIT_AUTHOR_NAME")?.value)
        .toBe(login);
      expect
        .soft(entries.find((entry) => entry.name === "GIT_AUTHOR_EMAIL")?.value)
        .toBe(email ?? `4242+${login}@users.noreply.github.com`);
    },
  );
});
