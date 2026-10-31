import { describe, expect, it } from "vitest";
import { checklistInput, completeShift, RuleError, setTask, startShift, type Checklist } from "./domain";

const checklist: Checklist = { id: "c1", name: "Opening", location: "North", kind: "opening", tasks: ["Clean", "Count"], archived: false };

describe("shift checklist rules", () => {
  it("snapshots the checklist, records an incomplete shift, and preserves its history after edits", () => {
    const started = startShift(checklist, "s1", "2026-01-01T06:00:00Z");
    const done = setTask(started, 0, true, "2026-01-01T06:10:00Z");
    const finished = completeShift(done, "2026-01-01T06:30:00Z");
    const edited = { ...checklist, name: "New name", tasks: ["Different task"] };
    expect(finished).toMatchObject({ name: "Opening", location: "North", completedAt: "2026-01-01T06:30:00Z", tasks: [{ text: "Clean", completedAt: "2026-01-01T06:10:00Z" }, { text: "Count", completedAt: null }] });
    expect(startShift(edited, "s2", "2026-01-02T06:00:00Z").tasks).toEqual([{ text: "Different task", completedAt: null }]);
    expect(() => setTask(finished, 1, true, "later")).toThrowError(RuleError);
  });

  it("supports reopening tasks without changing other task timestamps", () => {
    let shift = startShift(checklist, "s1", "start");
    shift = setTask(shift, 0, true, "first");
    shift = setTask(shift, 1, true, "second");
    shift = setTask(shift, 0, false, "third");
    expect(shift.tasks.map((task) => task.completedAt)).toEqual([null, "second"]);
    expect(() => setTask(shift, -1, true, "now")).toThrowError(RuleError);
    expect(() => startShift({ ...checklist, archived: true }, "s2", "now")).toThrowError(RuleError);
  });

  it("validates names, locations, task counts, lengths and shift types", () => {
    expect(checklistInput({ name: " A ", location: " B ", kind: "opening", tasks: [" C "] })).toEqual({ name: "A", location: "B", kind: "opening", tasks: ["C"] });
    for (const input of [
      { name: " ", location: "x", kind: "opening", tasks: ["x"] },
      { name: "x", location: "x", kind: "other", tasks: [] },
      { name: "x", location: "x", kind: "other", tasks: Array(51).fill("x") },
      { name: "x", location: "x", kind: "other", tasks: ["x".repeat(201)] },
      { name: "x", location: "x", kind: "noon", tasks: ["x"] },
    ]) expect(() => checklistInput(input)).toThrowError(RuleError);
  });
});
