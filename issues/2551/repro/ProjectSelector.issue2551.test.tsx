// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectSelector } from "./ProjectSelector";

afterEach(cleanup);

describe("ProjectSelector issue #2551 reproduction", () => {
  it("caps the desktop menu to its available height and lets it scroll", () => {
    const projects = Array.from({ length: 30 }, (_, index) => ({
      id: `proj_${index + 1}`,
      name: `QA Project ${String(index + 1).padStart(2, "0")}`,
    }));

    render(
      <ProjectSelector
        projects={projects}
        value={null}
        onChange={() => undefined}
        allowNoProject
        defaultOpen
        modal={false}
      />,
    );

    const menu = screen.getByRole("menu");
    expect(menu.className).toContain(
      "max-h-[var(--radix-dropdown-menu-content-available-height)]",
    );
    expect(menu.className).toContain("overflow-y-auto");
  });
});
