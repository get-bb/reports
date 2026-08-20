import { MARK } from "./provider-marks";

export default function setup(_app: unknown) {
  (globalThis as Record<string, unknown>).__collabMark = MARK;
}
