/** Pure shift-checklist rules. Persistence and presentation live at the plugin boundary. */
export type ShiftKind = "opening" | "closing" | "other";

export type Checklist = {
  id: string;
  name: string;
  location: string;
  kind: ShiftKind;
  tasks: string[];
  archived: boolean;
};

export type Shift = {
  id: string;
  checklistId: string;
  name: string;
  location: string;
  kind: ShiftKind;
  startedAt: string;
  status: "active" | "completed";
  completedAt: string | null;
  tasks: { text: string; completedAt: string | null }[];
};

export class RuleError extends Error {
  constructor(readonly code: "invalid_input" | "archived" | "completed" | "task_missing") {
    super(code);
  }
}

const clean = (value: unknown, max: number): string => {
  if (typeof value !== "string") throw new RuleError("invalid_input");
  const result = value.trim();
  if (!result || result.length > max) throw new RuleError("invalid_input");
  return result;
};

export function checklistInput(input: { name: unknown; location: unknown; kind: unknown; tasks: unknown }): Pick<Checklist, "name" | "location" | "kind" | "tasks"> {
  const name = clean(input.name, 100);
  const location = clean(input.location, 100);
  if (input.kind !== "opening" && input.kind !== "closing" && input.kind !== "other") throw new RuleError("invalid_input");
  if (!Array.isArray(input.tasks) || input.tasks.length < 1 || input.tasks.length > 50) throw new RuleError("invalid_input");
  return { name, location, kind: input.kind, tasks: input.tasks.map((task) => clean(task, 200)) };
}

export function startShift(checklist: Checklist, id: string, now: string): Shift {
  if (checklist.archived) throw new RuleError("archived");
  return {
    id,
    checklistId: checklist.id,
    name: checklist.name,
    location: checklist.location,
    kind: checklist.kind,
    startedAt: now,
    status: "active",
    completedAt: null,
    tasks: checklist.tasks.map((text) => ({ text, completedAt: null })),
  };
}

export function setTask(shift: Shift, index: number, complete: boolean, now: string): Shift {
  if (shift.completedAt !== null) throw new RuleError("completed");
  if (!Number.isInteger(index) || index < 0 || index >= shift.tasks.length) throw new RuleError("task_missing");
  return {
    ...shift,
    tasks: shift.tasks.map((task, i) => i === index ? { ...task, completedAt: complete ? task.completedAt ?? now : null } : task),
  };
}

export function completeShift(shift: Shift, now: string): Shift {
  if (shift.completedAt !== null) throw new RuleError("completed");
  return { ...shift, completedAt: now, status: "completed" };
}
