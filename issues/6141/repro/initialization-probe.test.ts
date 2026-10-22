import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { query } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: queryMock }));

import { probeClaudeInitialization } from "./initialization-probe.js";

const directories: string[] = [];

afterEach(async () => {
  queryMock.mockReset();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("initialization probe temporary config cleanup", () => {
  it.each([
    { location: "config", fails: false },
    { location: "home", fails: false },
    { location: "relative", fails: false },
    { location: "config", fails: true },
  ])(
    "cleans only its exited process files ($location, failure=$fails)",
    async ({ location, fails }) => {
      const directory = await mkdtemp(join(tmpdir(), "bb-probe-cleanup-"));
      directories.push(directory);
      const home = join(directory, "home");
      await mkdir(home);
      const config = location === "home" ? home : join(directory, "config");
      if (location !== "home") await mkdir(config);
      const fixture = join(directory, "cli.cjs");
      await writeFile(
        fixture,
        `
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const config = process.env.CLAUDE_CONFIG_DIR || process.env.HOME;
const prefix = ".claude.json.tmp." + process.pid + ".";
writeFileSync(join(config, ".claude.json"), "saved");
writeFileSync(join(config, "pid.txt"), String(process.pid));
process.stdin.resume();
process.stdin.on("end", () => {
  writeFileSync(join(config, prefix + "000000000000"), "unfinished");
  writeFileSync(join(config, prefix + "000000000000.extra"), "unrelated");
  writeFileSync(join(config, ".claude.json.tmp." + (process.pid + 1) + ".000000000000"), "other process");
  mkdirSync(join(config, prefix + "000000000001"));
  process.exit(0);
});
process.stdout.write("ready\\n");
`,
      );
      let exited = Promise.resolve();
      queryMock.mockImplementation(
        ({ options }: Parameters<typeof query>[0]) => {
          const spawnOptions = {
            command: process.execPath,
            args: [fixture],
            cwd: directory,
            env: {
              HOME: home,
              ...(location !== "home"
                ? {
                    CLAUDE_CONFIG_DIR:
                      location === "relative" ? "config" : config,
                  }
                : {}),
            },
            signal: new AbortController().signal,
          };
          const child = options?.spawnClaudeCodeProcess
            ? options.spawnClaudeCodeProcess(spawnOptions)
            : spawn(spawnOptions.command, spawnOptions.args, {
                ...spawnOptions,
                stdio: ["pipe", "pipe", "pipe"],
              });
          const ready = new Promise<void>((resolve, reject) => {
            child.stdout.once("data", () => resolve());
            child.on("error", reject);
          });
          exited = new Promise<void>((resolve) =>
            child.on("exit", () => resolve()),
          );
          return {
            initializationResult: async () => {
              await ready;
              if (fails) throw new Error("Initialization failed");
              return { models: [], commands: [] };
            },
            close: () => child.stdin.end(),
          };
        },
      );
      const result = probeClaudeInitialization({
        env: { BB_CLAUDE_CODE_EXECUTABLE: process.execPath },
        cwd: directory,
      });
      if (fails) await expect(result).rejects.toThrow("Initialization failed");
      else await result;
      await exited;
      const pid = Number(await readFile(join(config, "pid.txt"), "utf8"));
      await vi.waitFor(async () => {
        expect((await readdir(config)).sort()).toEqual(
          [
            ".claude.json",
            `.claude.json.tmp.${pid}.000000000000.extra`,
            `.claude.json.tmp.${pid}.000000000001`,
            `.claude.json.tmp.${pid + 1}.000000000000`,
            "pid.txt",
          ].sort(),
        );
      });
      expect(await readFile(join(config, ".claude.json"), "utf8")).toBe(
        "saved",
      );
    },
  );
});
