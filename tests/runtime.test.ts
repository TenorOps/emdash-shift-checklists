import { afterEach, expect, it } from "vitest";
import { createPluginRuntimeTestHost, type PluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import type { BlockResponse, ButtonElement } from "@emdash-cms/blocks";

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => { await host?.dispose(); host = undefined; });

function findButton(response: BlockResponse, action: string): ButtonElement {
  for (const block of response.blocks) {
    if (block.type === "actions") {
      const found = block.elements.find((element): element is ButtonElement => element.type === "button" && element.action_id === action);
      if (found) return found;
    }
    if (block.type === "section" && block.accessory?.type === "button" && block.accessory.action_id === action) return block.accessory;
  }
  throw new Error(`Missing action: ${action}`);
}

it("runs a shift through the real admin route, sandbox and persisted storage", async () => {
  host = await createPluginRuntimeTestHost();
  const page = "/checklists";
  expect(JSON.stringify(await host.admin.loadPage(page))).toContain("No checklists yet.");
  await host.admin.act(page, "new");
  const template = await host.admin.act(page, "template:opening");
  expect(JSON.stringify(template)).toContain("Check that the workspace is clean");
  const created = await host.admin.submit(page, "create", { name: "Morning", location: "North", kind: "opening", tasks: "Clean\nCount" });
  const checklistId = findButton(created, "start").value;
  expect(typeof checklistId).toBe("string");
  const started = await host.admin.act(page, "start", { value: checklistId });
  const task = findButton(started, "task");
  const updated = await host.admin.act(page, "task", { value: task.value });
  expect(findButton(updated, "task").label).toBe("Reopen task");
  const finish = findButton(updated, "finish");
  await host.admin.act(page, "finish", { value: finish.value });
  await host.restart();
  const reloaded = await host.admin.loadPage(page);
  expect(JSON.stringify(reloaded)).toContain("Morning");
  const history = await host.admin.act(page, "view", { value: findButton(reloaded, "view").value });
  expect(JSON.stringify(history)).toContain("Clean — Completed");
  expect(JSON.stringify(history)).toContain("Count — Incomplete");
  expect(JSON.stringify(history)).not.toContain("Mark complete");
  await host.admin.act(page, "archive", { value: checklistId });
  const afterArchive = await host.admin.loadPage(page);
  expect(JSON.stringify(afterArchive)).toContain("No checklists yet.");
  expect(JSON.stringify(afterArchive)).toContain("Morning");
});

it("navigates a large checklist list without dropping earlier entries", async () => {
  host = await createPluginRuntimeTestHost();
  const page = "/checklists";
  for (let i = 0; i < 17; i++) {
    await host.admin.submit(page, "create", { name: `Checklist ${i}`, location: "North", kind: "other", tasks: "Task" });
  }
  const first = await host.admin.loadPage(page);
  expect(JSON.stringify(first)).toContain("Checklist 0");
  expect(JSON.stringify(first)).not.toContain("Checklist 16");
  const second = await host.admin.act(page, "page:next", { value: findButton(first, "page:next").value });
  expect(JSON.stringify(second)).toContain("Checklist 16");
  const previous = await host.admin.act(page, "page:previous", { value: findButton(second, "page:previous").value });
  expect(JSON.stringify(previous)).toContain("Checklist 0");
});
