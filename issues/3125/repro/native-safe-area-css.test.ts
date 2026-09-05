import { describe, expect, it } from "vitest";
import {
  buildBridgeInjectionScript,
  type NativeShellHandshake,
} from "../src/index.js";

const handshake: NativeShellHandshake = {
  bridgeVersion: 2,
  appVersion: "0.42.0",
  platform: "ios",
  profileMode: "connect",
  secureContext: true,
  safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  capabilities: ["safe-area"],
};

describe("native safe-area CSS bridge", () => {
  it("publishes the handshake insets as root CSS variables", () => {
    const properties = new Map<string, string>();
    const fakeWindow = {
      ReactNativeWebView: { postMessage() {} },
      document: {
        documentElement: {
          style: {
            setProperty(name: string, value: string) {
              properties.set(name, value);
            },
          },
        },
      },
    };

    new Function("window", buildBridgeInjectionScript(handshake))(fakeWindow);

    expect(Object.fromEntries(properties)).toEqual({
      "--bb-native-safe-area-top": "59px",
      "--bb-native-safe-area-right": "0px",
      "--bb-native-safe-area-bottom": "34px",
      "--bb-native-safe-area-left": "0px",
    });
  });
});
