// bb-plugin-imageprobe — minimal repro plugin for get-bb/bb#1762.
//
// Registers one agent tool, `image_probe`, that returns ONLY image content —
// the same shape MGrin/bb-plugin-browser's `browser_screenshot` returns:
//   { content: [{ type: "image", data: <base64 png>, mimeType: "image/png" }] }
// A red 16x16 PNG is used so a model that really received the image can name
// its colour.
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

// 16x16 solid red PNG (generated with Python zlib/struct; see red16.png).
const RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=";

export default async function plugin(bb: BbPluginApi) {
  bb.agents.registerTool({
    name: "image_probe",
    description: "Returns a small PNG image as the tool result (image content only).",
    parameters: z.object({}),
    execute: async () => {
      bb.log.info("image_probe called; returning image-only content");
      return {
        content: [{ type: "image", data: RED_PNG_BASE64, mimeType: "image/png" }],
      };
    },
  });
}
