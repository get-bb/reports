// @vitest-environment jsdom

import { afterEach, expect, it, vi } from "vitest";
import { installFakeFlowLayout, setFakeHeight } from "@/test/fake-flow-layout";
import { ScrollPositionKeeper } from "./scroll-position-keeper";

let cleanup = () => {};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it.each([false, true])("releases a prepended-page correction after touch completion (removed target: %s)", (removed) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const viewport = document.createElement("div");
  const content = document.createElement("div");
  const target = document.createElement("button");
  const items = document.createElement("div");
  content.append(target, items);
  viewport.append(content);
  document.body.append(viewport);
  const layout = installFakeFlowLayout({ scrollElement: viewport, viewportHeight: 500 });
  const makeRow = (index: number) => {
    const row = document.createElement("div");
    row.dataset.timelineRowId = `entry-${index}`;
    setFakeHeight(row, 160);
    return row;
  };
  items.append(...Array.from({ length: 12 }, (_, index) => makeRow(index)));
  const keeper = new ScrollPositionKeeper({
    bottomThresholdPx: 4,
    deferWritesWhileScrolling: true,
    getContentElement: () => content,
    getFloorElement: () => null,
    getFooterElement: () => null,
    getScrollElement: () => viewport,
    getTopLevelRows: () => items.querySelectorAll<HTMLElement>("[data-timeline-row-id]"),
    initiallyAttached: false,
  });
  const disconnect = keeper.connect(viewport);
  cleanup = () => { disconnect(); layout.restore(); };
  layout.userScrollTo(40);
  layout.userScrollTo(0);
  vi.advanceTimersByTime(500);
  target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
  if (removed) target.remove();
  items.prepend(makeRow(-2), makeRow(-1));
  keeper.reconcile();
  expect(content.style.transform).not.toBe("");
  target.dispatchEvent(new TouchEvent("touchend", { bubbles: true }));
  vi.advanceTimersByTime(1000);
  console.log(JSON.stringify({ removed, scrollTop: viewport.scrollTop, transform: content.style.transform }));
  expect(viewport.scrollTop).toBe(320);
  expect(content.style.transform).toBe("");
});
