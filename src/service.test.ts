import { expect, it } from "vitest";
import { type Checklist, type Shift } from "./domain";
import { ChecklistService, type Collection } from "./service";

function memory<T>(): Collection<T> {
  const rows = new Map<string, { value: T; revision: number }>();
  return {
    async get(id) { return rows.get(id)?.value ?? null; },
    async getVersioned(id) { const row = rows.get(id); return row ? { value: row.value, revision: String(row.revision) } : null; },
    async compareAndSet(id, revision, value) {
      const old = rows.get(id);
      if ((old ? String(old.revision) : null) !== revision) return { applied: false };
      rows.set(id, { value, revision: (old?.revision ?? 0) + 1 });
      return { applied: true };
    },
  };
}

it("keeps shift records after a checklist is edited and archived", async () => {
  const checklists = memory<Checklist>();
  const shifts = memory<Shift>();
  let sequence = 0;
  const service = new ChecklistService(checklists, shifts, () => String(++sequence), () => "2026-01-01T00:00:00Z");
  const input = { name: "Opening", location: "North", kind: "opening", tasks: ["Clean", "Count"] };
  const checklist = await service.create(input);
  const shift = await service.start(checklist.id);
  await service.task(shift.id, 0, true);
  const revision = (await checklists.getVersioned(checklist.id))!.revision;
  await service.edit(checklist.id, revision, { ...input, name: "Revised", tasks: ["New"] });
  await expect(service.edit(checklist.id, revision, { ...input, name: "Stale" })).rejects.toThrow();
  expect((await checklists.get(checklist.id))?.name).toBe("Revised");
  await service.archive(checklist.id);
  await service.finish(shift.id);
  expect(await shifts.get(shift.id)).toMatchObject({ name: "Opening", tasks: [{ text: "Clean", completedAt: "2026-01-01T00:00:00Z" }, { text: "Count", completedAt: null }] });
  await expect(service.start(checklist.id)).rejects.toThrow();
  await expect(service.task(shift.id, 1, true)).rejects.toThrow();
});
