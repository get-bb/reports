---
name: plugin-commands
description: CLI commands contributed by installed BB plugins. Use when a task involves one of the plugin commands listed here; run them with bash like any other bb command.
---

# Plugin Commands

Installed BB plugins contribute these `bb` subcommands. Invoke them with
bash exactly like core `bb` commands; they run server-side.
Combined stdout and stderr is capped at 1048576 UTF-8 bytes. Above-limit
results fail atomically as `plugin_cli_output_too_large` and are never clipped;
use pagination or file/streaming commands for large results.

## bb automation — Inspect and manage automations (scheduled agent/script runs)

Contributed by plugin `automations`. Run `bb automation --help` for details;
`bb plugin run automations <args...>` is the explicit equivalent.

- `bb automation list --project <id> [--json]` — List automations for a project
- `bb automation create --project <id> --name <name> [schedule flags] [mode flags]` — Create an automation
- `bb automation show <automationId> --project <id> [--json]` — Show automation details
- `bb automation update <automationId> --project <id> [flags]` — Update automation configuration
- `bb automation pause <automationId> --project <id> [--json]` — Pause an automation
- `bb automation resume <automationId> --project <id> [--json]` — Resume an automation
- `bb automation run <automationId> --project <id> [--idempotency-key <key>] [--json]` — Run an automation now
- `bb automation runs <automationId> --project <id> [--limit <count>] [--output <runId>] [--json]` — List automation runs
- `bb automation delete <automationId> --project <id> --yes [--json]` — Delete an automation
## bb connect — Expose this bb at https://<handle>.getbb.app (pair with --code/--server from the dashboard)

Contributed by plugin `connect`. Run `bb connect --help` for details;
`bb plugin run connect <args...>` is the explicit equivalent.

- `bb connect status [--json]` — Show remote-access status
- `bb connect off [--json]` — Disconnect and forget the pairing
- `bb connect expose <port> [--host <name-or-id>] [--json]` — Share an HTTP port from an enrolled host
- `bb connect unexpose <port> [--host <name-or-id>] [--json]` — Stop sharing an HTTP port from a host
- `bb connect shares [--host <name-or-id>] [--json]` — List shared ports and their public URLs
- `bb connect servers [--json]` — List every bb server on this account
## bb instructions — Read and update the custom instructions injected into agents

Contributed by plugin `custom-instructions`. Run `bb instructions --help` for details;
`bb plugin run custom-instructions <args...>` is the explicit equivalent.

- `bb instructions get [--json]` — Print the current custom instructions
- `bb instructions set <text...> [--json]` — Replace the custom instructions
- `bb instructions clear [--json]` — Clear the custom instructions
## bb keep-awake — Configure macOS idle-sleep prevention

Contributed by plugin `keep-awake`. Run `bb keep-awake --help` for details;
`bb plugin run keep-awake <args...>` is the explicit equivalent.

- `bb keep-awake status [--json]` — Show whether Keep Awake is enabled and which hosts it uses
- `bb keep-awake enable [--json]` — Enable Keep Awake
- `bb keep-awake disable [--json]` — Disable Keep Awake
- `bb keep-awake hosts [all|<host-id>...] [--json]` — Show or replace the Keep Awake host selection
## bb secret — Securely request credentials and write them to a dotenv file.

Contributed by plugin `secrets`. Run `bb secret --help` for details;
`bb plugin run secrets <args...>` is the explicit equivalent.

- `bb secret request <NAME...> --write-env <path> [--purpose <text>] [--describe <NAME> <text>]...` — Request one or more secrets in a secure user form.
