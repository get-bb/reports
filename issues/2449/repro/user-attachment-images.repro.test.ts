import { describe, expect, it } from "vitest";
import { toUserAttachmentImageSrc } from "./user-attachment-images";

describe("issue 2449: absolute user image paths", () => {
  it("does not route an absolute host path through project attachments", () => {
    const src = toUserAttachmentImageSrc("/tmp/reference.png", "proj_2449");

    expect(src).not.toContain(
      "/api/v1/projects/proj_2449/attachments/content",
    );
  });
});
