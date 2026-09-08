it("shuts down provider maintenance workers when a request never settles", async () => {
  vi.useFakeTimers();
  try {
    const dataDir = await makeTempDir("bb-provider-maintenance-stuck-");
    const runtime = createFakeRuntime();
    const requestStarted = createDeferredPromise<void>();
    const manager = new RuntimeManager({
      createRuntime: () => runtime,
      providerMaintenanceIdleTimeoutMs: 100,
    });

    void manager.withProviderMaintenanceRuntime(
      { dataDir },
      async () => {
        requestStarted.resolve();
        return new Promise<never>(() => undefined);
      },
    );
    await requestStarted.promise;
    await vi.advanceTimersByTimeAsync(100);

    expect(runtime.shutdown).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
