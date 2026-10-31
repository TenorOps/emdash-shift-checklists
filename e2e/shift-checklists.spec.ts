import { createRequire } from "node:module";
import { resolve } from "node:path";

// Use the runner's Playwright instance in both the monorepo and a standalone checkout.
const { expect, test } = createRequire(resolve(process.cwd(), "package.json"))("@playwright/test") as typeof import("@playwright/test");

test("a restaurant operator creates, edits and completes a shift, then reviews it after archiving", async ({ page, browser }) => {
  const name = `Morning ${Date.now()}`;
  await page.goto("/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByText("Shift checklists", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shift checklists" })).toBeVisible();
  await page.getByRole("button", { name: "Create checklist" }).click();
  await page.getByRole("button", { name: "Opening", exact: true }).click();
  await expect(page.getByLabel("Tasks")).toHaveValue(/Check that the workspace is clean/);
  await page.getByLabel("Checklist name").fill(name);
  await page.getByLabel("Location").fill("North");
  await page.getByLabel("Tasks").fill("Clean surfaces\nCount supplies");
  await page.getByRole("button", { name: "Create checklist" }).click();
  await expect(page.getByText(`${name} · North`)).toBeVisible();
  await page.getByRole("button", { name: "Start shift" }).last().click();
  await expect(page.getByText("Clean surfaces", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark complete" }).first().click();
  await expect(page.getByRole("button", { name: "Reopen task" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "In progress" }).last().click();
  await expect(page.getByRole("button", { name: "Reopen task" })).toBeVisible();
  await page.getByRole("button", { name: "Complete shift" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Complete shift" }).click();
  await expect(page.getByRole("button", { name: "Mark complete" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  const secondEditor = await page.context().newPage();
  await secondEditor.goto(page.url());
  await secondEditor.getByRole("button", { name: "Edit", exact: true }).last().click();
  await secondEditor.getByLabel("Tasks").fill("Outdated change");
  await page.getByRole("button", { name: "Edit", exact: true }).last().click();
  await page.getByLabel("Tasks").fill("Replace stock");
  await page.getByRole("button", { name: "Save changes" }).click();
  await secondEditor.getByRole("button", { name: "Save changes" }).click();
  await expect(secondEditor.getByText("This checklist changed. Open it again to review the latest version.")).toBeVisible();
  await secondEditor.getByRole("button", { name: "Edit", exact: true }).last().click();
  await expect(secondEditor.getByLabel("Tasks")).toHaveValue("Replace stock");
  await secondEditor.close();
  await page.getByRole("button", { name: "Archive", exact: true }).last().click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
  await page.reload();
  await page.getByRole("button", { name: "View history" }).first().click();
  await expect(page.getByText("Clean surfaces — Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Count supplies — Incomplete", { exact: true })).toBeVisible();
  await expect(page.getByText("Replace stock", { exact: true })).toHaveCount(0);

  // Seed enough separate checklists to exercise the admin's real pagination controls.
  for (let index = 0; index < 17; index++) {
    const response = await page.request.post("/_emdash/api/plugins/restaurant-shift-checklists/admin", {
      headers: { "X-EmDash-Request": "1" },
      data: { type: "form_submit", page: "/checklists", action_id: "create", values: { name: `Pagination ${index}`, location: "West", kind: "other", tasks: "Task" } },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Pagination 0 · West")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Pagination 16 · West")).toBeVisible();
  await expect(page.getByText("Pagination 0 · West")).toHaveCount(0);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("Pagination 0 · West")).toBeVisible();

  const anonymous = await browser.newContext();
  const response = await anonymous.request.post("http://127.0.0.1:4329/_emdash/api/plugins/restaurant-shift-checklists/admin", { data: { type: "page_load", page: "/checklists" }, headers: { "X-EmDash-Request": "1" } });
  expect([401, 403]).toContain(response.status());
  await anonymous.close();
});
