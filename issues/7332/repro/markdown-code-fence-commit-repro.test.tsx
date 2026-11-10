// @vitest-environment jsdom

import { Profiler } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { PluginCodeFenceRendererSlot } from "@/lib/plugin-slots";
import {
  buildCodeFenceRendererRegistry,
  CodeFencePlaceholder,
  CodeFenceRendererHost,
  type CodeFenceRendererRegistry,
} from "./markdown-code-fence-renderers";

function EmptyFence() {
  return null;
}

const registration: PluginCodeFenceRendererSlot = {
  id: "commit-probe",
  pluginId: "repro",
  generation: 1,
  languages: ["ui"],
  component: EmptyFence,
};

function fenceTree(registry: CodeFenceRendererRegistry) {
  return (
    <CodeFenceRendererHost
      registry={registry}
      message={{ id: "message", threadId: "thread", turnId: null, projectId: null }}
      streaming={false}
    >
      Before
      <CodeFencePlaceholder
        closed={true}
        code="sample payload"
        language="ui"
        offset={0}
        original={<pre>sample payload</pre>}
      />
      After
    </CodeFenceRendererHost>
  );
}

afterEach(cleanup);

it("mounts a null fence renderer without a synchronous follow-up commit", () => {
  const controlPhases: string[] = [];
  const control = render(
    <Profiler id="control" onRender={(_id, phase) => controlPhases.push(phase)}>
      {fenceTree(buildCodeFenceRendererRegistry([]))}
    </Profiler>,
  );
  expect(control.container.textContent).toContain("sample payload");
  control.unmount();
  const rendererPhases: string[] = [];
  const renderer = render(
    <Profiler id="renderer" onRender={(_id, phase) => rendererPhases.push(phase)}>
      {fenceTree(buildCodeFenceRendererRegistry([registration]))}
    </Profiler>,
  );
  expect(renderer.container.textContent).toContain("Before");
  expect(renderer.container.textContent).not.toContain("sample payload");
  expect(controlPhases).toEqual(["mount"]);
  expect(rendererPhases).toEqual(controlPhases);
});
