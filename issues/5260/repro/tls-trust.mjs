import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import tls from "node:tls";

const scriptPath = fileURLToPath(import.meta.url);
const checkout = resolve(process.argv[2]);
const mode = process.argv[3];

if (mode) {
  const baseUrl = process.argv[4];
  const root = (await readFile(process.env.SSL_CERT_FILE, "utf8")).trim();
  const containsRoot = (certificates) =>
    certificates.some((certificate) => certificate.trim() === root);
  const systemHasRoot = containsRoot(tls.getCACertificates("system"));
  const defaultHasRoot = containsRoot(tls.getCACertificates("default"));
  assert.equal(systemHasRoot, true);
  assert.equal(defaultHasRoot, mode === "system");
  console.log(`${mode}: system_has_root=${systemHasRoot} default_has_root=${defaultHasRoot}`);

  const { createBbAppProcessEnv } = await import(
    pathToFileURL(join(checkout, "apps/desktop/src/bb-process.ts"))
  );
  const desktopEnv = createBbAppProcessEnv({ env: {}, runtimeMode: "electron-node" });
  assert.equal(desktopEnv.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(desktopEnv.NODE_USE_SYSTEM_CA, undefined);
  console.log(`${mode}: desktop_sets_system_ca=false`);

  try {
    const response = await fetch(baseUrl);
    assert.equal(mode, "system");
    assert.equal(response.status, 200);
    console.log(`${mode}: native_fetch_status=${response.status}`);
  } catch (error) {
    assert.equal(mode, "default");
    assert.equal(error.cause?.code, "SELF_SIGNED_CERT_IN_CHAIN");
    console.log(`${mode}: native_fetch_error=${error.cause.code}`);
  }

  const { HostedRequestError, startLink } = await import(
    pathToFileURL(join(checkout, "plugins/bb-account/src/hosted.ts"))
  );
  try {
    const result = await startLink(baseUrl, "slopcop-local-5260");
    assert.equal(mode, "system");
    assert.equal(result.userCode, "local-test-code");
    console.log(`${mode}: hosted_start_link=success`);
  } catch (error) {
    assert.equal(mode, "default");
    assert.ok(error instanceof HostedRequestError);
    assert.equal(error.status, null);
    assert.equal(error.code, "network");
    assert.match(error.message, /self.signed certificate in certificate chain/i);
    console.log(`${mode}: hosted_start_link=network status=null tls_message_present=true`);
  }
} else {
  const directory = await mkdtemp(join(tmpdir(), "slopcop-tls-5260-"));
  const openssl = (...args) =>
    execFileSync("openssl", args, { cwd: directory, stdio: "ignore" });
  let server;
  try {
    openssl(
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", "root.key", "-out", "root.pem", "-subj", "/CN=SlopCop Local CA",
      "-addext", "basicConstraints=critical,CA:TRUE",
    );
    openssl(
      "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key",
      "-out", "leaf.csr", "-subj", "/CN=localhost",
      "-addext", "subjectAltName=IP:127.0.0.1",
      "-addext", "basicConstraints=critical,CA:FALSE",
    );
    openssl(
      "x509", "-req", "-in", "leaf.csr", "-CA", "root.pem", "-CAkey", "root.key",
      "-CAcreateserial", "-days", "1", "-copy_extensions", "copy", "-out", "leaf.pem",
    );
    server = createServer(
      {
        key: await readFile(join(directory, "leaf.key")),
        cert: Buffer.concat([
          await readFile(join(directory, "leaf.pem")),
          await readFile(join(directory, "root.pem")),
        ]),
      },
      (request, response) => {
        const baseUrl = `https://${request.headers.host}`;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          deviceCode: "local-test-device",
          userCode: "local-test-code",
          verificationUrl: `${baseUrl}/verify`,
          expiresAt: Date.now() + 60000,
          intervalMs: 1000,
        }));
      },
    );
    const listeners = [
      await readFile("/proc/net/tcp", "utf8"),
      await readFile("/proc/net/tcp6", "utf8"),
    ].join("\n");
    let port;
    do {
      port = randomInt(40000, 60001);
    } while (listeners.split("\n").some((line) =>
      line.trim().split(/\s+/)[1]?.endsWith(`:${port.toString(16).toUpperCase()}`),
    ));
    server.listen(port, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `https://127.0.0.1:${server.address().port}`;
    console.log(`runtime=${process.version} platform=${process.platform}`);
    console.log(`fixture_port=${port} isolated_trust_material=true`);
    const environment = {
      PATH: process.env.PATH,
      HOME: directory,
      SSL_CERT_FILE: join(directory, "root.pem"),
      SSL_CERT_DIR: directory,
    };
    for (const trustMode of ["default", "system"]) {
      const child = spawn(process.execPath, [
        ...(trustMode === "system" ? ["--use-system-ca"] : []),
        "--conditions=source", "--import", "tsx", scriptPath,
        checkout, trustMode, baseUrl,
      ], { cwd: checkout, env: environment, stdio: "inherit" });
      const [exitCode] = await once(child, "exit");
      assert.equal(exitCode, 0);
    }
    console.log("PASS: system-store root excluded by default; opt-in restores real hosted sign-in transport");
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    await rm(directory, { recursive: true, force: true });
  }
}
