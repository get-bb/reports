import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);

it("diagnoses the real probe with untrusted, trusted, and hostname-invalid TLS", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "bb-6910-tls-"));
  const port = Number(process.env.BB_6910_PORT ?? "56191");
  const caKey = path.join(temporary, "ca.key");
  const caCertificate = path.join(temporary, "ca.pem");
  const serverKey = path.join(temporary, "server.key");
  const serverRequest = path.join(temporary, "server.csr");
  const serverCertificate = path.join(temporary, "server.pem");
  const extensions = path.join(temporary, "server.ext");
  const requests: string[] = [];
  let server: ReturnType<typeof createServer> | undefined;

  try {
    await execute("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=BB isolated diagnostic CA", "-keyout", caKey,
      "-out", caCertificate, "-addext", "basicConstraints=critical,CA:TRUE",
      "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    ]);
    await execute("openssl", [
      "req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=127.0.0.1",
      "-keyout", serverKey, "-out", serverRequest,
    ]);
    await writeFile(extensions, [
      "basicConstraints=critical,CA:FALSE",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage=serverAuth",
      "subjectAltName=IP:127.0.0.1",
      "",
    ].join("\n"));
    await execute("openssl", [
      "x509", "-req", "-in", serverRequest, "-CA", caCertificate,
      "-CAkey", caKey, "-CAcreateserial", "-days", "1", "-out",
      serverCertificate, "-extfile", extensions,
    ]);
    server = createServer({
      key: await readFile(serverKey),
      cert: await readFile(serverCertificate),
    }, (request, response) => {
      requests.push(request.url ?? "");
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(request.url === "/health"
        ? { ok: true }
        : { serverUrl: "http://127.0.0.1", primaryHostId: null }));
    });
    server.listen(port, "127.0.0.1");
    await once(server, "listening");

    const probeSource = fileURLToPath(new URL("./probe.ts", import.meta.url));
    const program = [
      'import { createRequire } from "node:module";',
      `const { probeServer } = createRequire(import.meta.url)(${JSON.stringify(probeSource)});`,
      "let errorCause = null;",
      "const observedFetch = async (url, init) => {",
      "  try { return await fetch(url, init); }",
      "  catch (error) { errorCause = error.cause?.code; throw error; }",
      "};",
      "const result = await probeServer(process.argv[1], observedFetch);",
      "console.log(JSON.stringify({ result, errorCause }));",
    ].join("\n");
    const runProbe = async (hostname: string, trustCa: boolean) => {
      const { stdout } = await execute(process.execPath, [
        "--dns-result-order=ipv4first", "--import", "tsx",
        "--input-type=module", "--eval", program,
        `https://${hostname}:${port}`,
      ], {
        env: {
          PATH: process.env.PATH,
          ...(trustCa ? { NODE_EXTRA_CA_CERTS: caCertificate } : {}),
        },
        timeout: 12_000,
      });
      return JSON.parse(stdout.trim());
    };

    const untrusted = await runProbe("127.0.0.1", false);
    expect(untrusted.result).toMatchObject({
      ok: false, stage: "health", error: "fetch failed",
    });
    expect(untrusted.errorCause).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(requests).toEqual([]);

    const trusted = await runProbe("127.0.0.1", true);
    expect(trusted.result).toMatchObject({ ok: true, advertisedServerUrl: null });
    expect(trusted.errorCause).toBeNull();
    expect(requests).toEqual(["/health", "/api/v1/system/config"]);

    requests.length = 0;
    const hostnameInvalid = await runProbe("localhost", true);
    expect(hostnameInvalid.result).toMatchObject({
      ok: false, stage: "health", error: "fetch failed",
    });
    expect(hostnameInvalid.errorCause).toBe("ERR_TLS_CERT_ALTNAME_INVALID");
    expect(requests).toEqual([]);
    console.log(JSON.stringify({
      runtime: "Node.js surrogate, not Android",
      untrusted, trusted, hostnameInvalid,
    }));
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => error ? reject(error) : resolve());
      });
    }
    await rm(temporary, { recursive: true, force: true });
  }
}, 30_000);
