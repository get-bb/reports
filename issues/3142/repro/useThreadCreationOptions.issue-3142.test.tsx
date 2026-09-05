// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type {
  SystemExecutionOptionsResponse,
  SystemProviderState,
} from "@bb/server-contract";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { makeProviderInfo } from "@bb/test-helpers/domain-fixtures";
import { sdk } from "@/lib/sdk";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { useThreadCreationOptions } from "./useThreadCreationOptions";

const REMEMBERED_PROVIDER_ID = "project-provider";
const READY_PROVIDER_ID = "global-provider";

vi.mock("@/lib/sdk", () => ({
  sdk: {
    system: {
      executionOptions: vi.fn(),
      providerStates: vi.fn(),
    },
  },
}));

function providerState(
  providerId: string,
  status: SystemProviderState["status"],
): SystemProviderState {
  return {
    providerId,
    displayName: providerId,
    status,
    statusMessage: null,
    planLabel: null,
    accountEmail: null,
    installedVersion: null,
    minimumSupportedVersion: null,
    canInstall: false,
    canUpdate: false,
    loginCommand: null,
  };
}

function executionOptions(): SystemExecutionOptionsResponse {
  const provider = makeProviderInfo({
    id: READY_PROVIDER_ID,
    displayName: "Ready Provider",
    logoUrl: null,
    maintenance: { health: true, usage: false, installation: true },
    composerActions: [],
  });
  return {
    providers: [
      provider,
      {
        ...provider,
        id: REMEMBERED_PROVIDER_ID,
        displayName: "Remembered Provider",
      },
    ],
    models: [],
    selectedOnlyModels: [],
    permissionCeiling: "full",
    modelLoadError: null,
  };
}

beforeEach(() => {
  window.localStorage.setItem(
    "bb.promptbox.environment",
    "host:first-host:local",
  );
  window.localStorage.setItem(
    "bb.promptbox.provider",
    REMEMBERED_PROVIDER_ID,
  );
  vi.mocked(sdk.system.executionOptions).mockResolvedValue(executionOptions());
  vi.mocked(sdk.system.providerStates).mockImplementation(async (args) => ({
    providers:
      args?.hostId === "second-host"
        ? [
            providerState(REMEMBERED_PROVIDER_ID, "not_installed"),
            providerState(READY_PROVIDER_ID, "ready"),
          ]
        : [providerState(REMEMBERED_PROVIDER_ID, "ready")],
  }));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

it("removes a remembered unavailable provider and selects a ready provider after a machine change", async () => {
  const { result } = renderHook(
    () =>
      useThreadCreationOptions({
        scope: "new-thread",
        preferReadyProviderWhenUnset: true,
      }),
    { wrapper: createQueryClientTestHarness().wrapper },
  );

  await waitFor(() => {
    expect(result.current.selectedProviderId).toBe(REMEMBERED_PROVIDER_ID);
  });

  act(() => {
    result.current.setEnvironmentSelectionValue("host:second-host:local");
  });

  await waitFor(() => {
    expect(sdk.system.executionOptions).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: "second-host" }),
    );
    expect(result.current.providerOptions.length).toBeGreaterThan(0);
  });
  expect.soft(
    result.current.providerOptions.map((option) => option.value),
  ).toEqual([READY_PROVIDER_ID]);
  expect(result.current.selectedProviderId).toBe(READY_PROVIDER_ID);
});
