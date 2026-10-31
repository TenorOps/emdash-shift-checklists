import { expect, it } from "vitest";
import { nextPage, parsePageState, previousPage, type PageState } from "./pagination";

it("preserves the cursor path for backward navigation and rejects malformed state", () => {
  const first = { list: "history" as const, cursors: [null] };
  const second = nextPage(first, "cursor-1");
  const third = nextPage(second, "cursor-2");
  expect(previousPage(third)).toEqual(second);
  expect(parsePageState(JSON.stringify(third))).toEqual(third);
  for (const invalid of ["", "{}", JSON.stringify({ list: "other", cursors: [null] }), JSON.stringify({ list: "active", cursors: [null, null] }), JSON.stringify({ list: "active", cursors: [null, 1] })]) expect(parsePageState(invalid)).toBeNull();
  let page: PageState = first;
  for (let index = 0; index < 150; index++) page = nextPage(page, `cursor-${index}`);
  expect(page.cursors.length).toBeLessThanOrEqual(100);
  expect(parsePageState(JSON.stringify(page))).toEqual(page);
});
