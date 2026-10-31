import { expect, it } from "vitest";
import { updateRecord, WriteConflict, type VersionedCollection } from "./storage";

it("reapplies a change on top of a concurrent write instead of losing it", async () => {
  let state = { first: false, second: false };
  let revision = 1;
  let raced = false;
  const store: VersionedCollection<typeof state> = {
    async getVersioned() { return { value: { ...state }, revision: String(revision) }; },
    async compareAndSet(_id, expected, value) {
      if (!raced) { raced = true; state.first = true; revision++; }
      if (expected !== String(revision)) return { applied: false };
      state = value; revision++; return { applied: true };
    },
  };
  await updateRecord(store, "shift", (current) => ({ ...current, second: true }));
  expect(state).toEqual({ first: true, second: true });
});

it("stops retrying persistent conflicts", async () => {
  let writes = 0;
  const store: VersionedCollection<number> = {
    async getVersioned() { return { value: 0, revision: "1" }; },
    async compareAndSet() { writes++; return { applied: false }; },
  };
  await expect(updateRecord(store, "shift", (value) => value + 1)).rejects.toBeInstanceOf(WriteConflict);
  expect(writes).toBe(5);
});
