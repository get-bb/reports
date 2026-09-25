  it("serves a byte range from a thread storage video", async () => {
    await withTestHarness(async (harness) => {
      const { host, session, thread } = seedThreadFixture(harness);
      const bytes = Buffer.from([0, 1, 2, 3, 4, 5]);
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          if (request.command.type !== "host.read_file_chunk")
            throw new Error("Unexpected command");
          expect(request.command.length).toBeLessThanOrEqual(2);
          expect(request.command.rootPath).toContain(thread.id);
          return {
            ok: true,
            result: {
              path: "/tmp/clip.mp4",
              content: bytes
                .subarray(
                  request.command.offset,
                  request.command.offset + request.command.length,
                )
                .toString("base64"),
              offset: request.command.offset,
              modifiedAtMs: 1234,
              mimeType: "video/mp4",
              sizeBytes: bytes.length,
              revision: "0".repeat(64),
            },
          };
        },
      });
      const response = await harness.app.request(
        `/api/v1/threads/${thread.id}/thread-storage/files/clip.mp4`,
        { headers: { Range: "bytes=0-1" } },
      );
      expect(response.status).toBe(206);
      expect(response.headers.get("accept-ranges")).toBe("bytes");
      expect(response.headers.get("content-range")).toBe("bytes 0-1/6");
      expect(response.headers.get("content-length")).toBe("2");
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        bytes.subarray(0, 2),
      );
    });
  });

