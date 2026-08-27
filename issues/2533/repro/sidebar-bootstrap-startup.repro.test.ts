import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/api";
import { shouldRetryTransientReadQuery } from "./query-helpers";

describe("sidebar bootstrap startup policy", () => {
  it("keeps retrying transport errors after the generic read budget ends", () => {
    expect(
      shouldRetryTransientReadQuery(2, new TypeError("Failed to fetch")),
    ).toBe(true);
  });

  it("retries a temporary server warm-up response", () => {
    expect(
      shouldRetryTransientReadQuery(
        0,
        new HttpError({ status: 503, message: "Server is warming up" }),
      ),
    ).toBe(true);
  });
});
