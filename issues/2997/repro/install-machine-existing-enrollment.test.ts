it("starts the daemon for an existing enrollment when service setup is skipped", () => {
  const fixture = createFixture();
  const invocationPath = join(fixture.dataDir, "invocation");
  const daemonPidPath = join(fixture.dataDir, "install-daemon.pid");
  writeCurlArtifactMock(fixture, 404);
  writeEnrollingBbApp(fixture, invocationPath);
  writeJoinedState(fixture);

  const result = runScript(JOIN_ARGS, fixture, {
    BB_INSTALL_SKIP_SERVICE: "1",
  });

  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("already joined");
  try {
    expect(existsSync(daemonPidPath)).toBe(true);
    expect(readFileSync(invocationPath, "utf8").trim().split("\n")).toEqual([
      "host-daemon",
      "--auto-update",
      "--host-daemon-port",
      readFileSync(join(fixture.dataDir, "host-daemon-port"), "utf8").trim(),
      "--server-url",
      "https://machine.getbb.app",
    ]);
  } finally {
    if (existsSync(daemonPidPath)) {
      process.kill(Number(readFileSync(daemonPidPath, "utf8")), "SIGTERM");
    }
  }
});
