import { checklistInput, completeShift, RuleError, setTask, startShift, type Checklist, type Shift } from "./domain";
import { MissingRecord, updateRecord, WriteConflict, type VersionedCollection } from "./storage";

export interface Collection<T> extends VersionedCollection<T> {
  get(id: string): Promise<T | null>;
}

/** Ids and time are supplied at the boundary so actions can be tested deterministically. */
export class ChecklistService {
  constructor(private readonly checklists: Collection<Checklist>, private readonly shifts: Collection<Shift>, private readonly id: () => string, private readonly now: () => string) {}

  async create(input: Parameters<typeof checklistInput>[0]): Promise<Checklist> {
    const checklist: Checklist = { ...checklistInput(input), id: this.id(), archived: false };
    if (!(await this.checklists.compareAndSet(checklist.id, null, checklist)).applied) throw new Error("id_conflict");
    return checklist;
  }

  async edit(id: string, revision: string, input: Parameters<typeof checklistInput>[0]): Promise<Checklist> {
    const values = checklistInput(input);
    const current = await this.checklists.getVersioned(id);
    if (!current) throw new MissingRecord();
    if (current.value.archived) throw new RuleError("archived");
    if (current.revision !== revision) throw new WriteConflict();
    const next = { ...current.value, ...values };
    if (!(await this.checklists.compareAndSet(id, revision, next)).applied) throw new WriteConflict();
    return next;
  }

  async archive(id: string): Promise<Checklist> {
    return updateRecord(this.checklists, id, (current) => ({ ...current, archived: true }));
  }

  async start(id: string): Promise<Shift> {
    const checklist = await this.checklists.get(id);
    if (!checklist) throw new MissingRecord();
    const shift = startShift(checklist, this.id(), this.now());
    if (!(await this.shifts.compareAndSet(shift.id, null, shift)).applied) throw new Error("id_conflict");
    return shift;
  }

  async task(id: string, index: number, completed: boolean): Promise<Shift> {
    const now = this.now();
    return updateRecord(this.shifts, id, (current) => setTask(current, index, completed, now));
  }

  async finish(id: string): Promise<Shift> {
    const now = this.now();
    return updateRecord(this.shifts, id, (current) => completeShift(current, now));
  }
}
