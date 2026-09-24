// @vitest-environment jsdom

import { act, cleanup, fireEvent } from "@testing-library/react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { afterEach, expect, it, vi } from "vitest";
import { installTestPluginRuntime, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { makeSidebarThread } from "../model/fixtures.js";
import { buildSectionThreadList, CHRONOLOGICAL_CONTAINER_ID } from "../model/project-thread-groups.js";
import { buildPinnedSidebarState } from "../model/pinned-sidebar-threads.js";

installTestPluginRuntime();
const { useSectionThreadDnd } = await import("./useSectionThreadDnd.js");

const pinned = makeSidebarThread({ id: "pinned-thread", projectId: "project", pinnedAt: 42, sectionId: "a" });
const pinnedState = buildPinnedSidebarState({ groupEnvironmentThreads: true, threads: [pinned] });
const rootItems = buildSectionThreadList([], undefined, [{ id: "a", name: "Section A" }]);

function Row() {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: pinned.id });
  return <button ref={setNodeRef} {...listeners} {...attributes} data-testid="row">Pinned thread</button>;
}

function Section() {
  const { setNodeRef } = useDroppable({ id: "section:a" });
  return <div ref={setNodeRef} data-testid="section">Section A</div>;
}

function Harness() {
  const state = useSectionThreadDnd({
    containerId: CHRONOLOGICAL_CONTAINER_ID,
    enabled: true,
    rootItems,
    topLevelSectionOrder: ["pinned", "section:a", "threads"],
    onTopLevelSectionOrderChange: vi.fn(),
    pinnedReorderPending: false,
    pinnedThreads: [pinned],
    pinnedRootItems: pinnedState.rootItems,
    pinnedRootNodes: pinnedState.rootNodes,
    onReorderPinnedThread: vi.fn(),
  });
  return <div data-sidebar="sidebar"><DndContext {...state?.dndContextProps}><Row /><Section /></DndContext></div>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([100, 210])("a %i ms touch with 4px drift must preserve pin state", async (holdMs) => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.dataset.testid === "row") return new DOMRect(0, 0, 200, 40);
    if (this.dataset.testid === "section") return new DOMRect(0, 40, 200, 40);
    return new DOMRect(0, 0, 200, 200);
  });
  const slot = renderSlot({ component: Harness }, {}, {});
  const row = document.querySelector('[data-testid="row"]')!;
  const touch = (y: number) => ({ identifier: 1, target: row, clientX: 100, clientY: y, pageX: 100, pageY: y, screenX: 100, screenY: y });
  fireEvent.touchStart(row, { touches: [touch(39)], changedTouches: [touch(39)] });
  act(() => vi.advanceTimersByTime(holdMs));
  fireEvent.touchMove(row, { touches: [touch(43)], changedTouches: [touch(43)] });
  fireEvent.touchEnd(row, { touches: [], changedTouches: [touch(43)] });
  await act(async () => {});
  expect(slot.inspection.sidebarActionCalls).toEqual([]);
});
