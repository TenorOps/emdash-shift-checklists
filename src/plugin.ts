import type { SandboxedPlugin } from "emdash/plugin";
import type { StorageCollection } from "emdash";
import type { Block, BlockResponse, ButtonElement } from "@emdash-cms/blocks";
import { z } from "zod";
import { RuleError, type Checklist, type Shift } from "./domain";
import { ChecklistService } from "./service";
import { MissingRecord, WriteConflict } from "./storage";
import { nextPage, parsePageState, previousPage, type ListName, type PageState } from "./pagination";

const interaction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page_load"), page: z.string() }),
  z.object({ type: z.literal("block_action"), action_id: z.string(), value: z.unknown().optional() }),
  z.object({ type: z.literal("form_submit"), action_id: z.string(), values: z.record(z.string(), z.unknown()) }),
]);
const form = z.object({ name: z.string(), location: z.string(), kind: z.enum(["opening", "closing", "other"]), tasks: z.string() });
const templates: Record<string, string> = {
  blank: "",
  opening: "Check that the workspace is clean\nCheck equipment is ready\nConfirm supplies are available\nReview the day's priorities.",
  closing: "Clean work surfaces and equipment\nStore supplies safely\nCheck equipment is switched off as appropriate\nSecure the premises.",
};
const shifts = [
  { label: "Opening", value: "opening" },
  { label: "Closing", value: "closing" },
  { label: "Other", value: "other" },
];
const button = (label: string, action_id: string, value?: unknown): ButtonElement => ({ type: "button", label, action_id, value });
const actions = (...elements: ButtonElement[]): Block => ({ type: "actions", elements });
const text = (value: string): Block => ({ type: "section", text: value });

function editForm(checklist?: Checklist, template = "blank", draft?: Record<string, unknown>, revision?: string): BlockResponse {
  const selected = template === "closing" ? "closing" : template === "opening" ? "opening" : "other";
  const field = (name: string, fallback: string) => typeof draft?.[name] === "string" ? draft[name] as string : fallback;
  return { blocks: [
    { type: "header", text: "Shift checklists" },
    ...(checklist ? [] : [actions(button("Blank", "template:blank"), button("Opening", "template:opening"), button("Closing", "template:closing")), text("Adapt these examples to your location and operating procedures.")]),
    { type: "form", block_id: `checklist-${checklist?.id ?? template}`, fields: [
      { type: "text_input", action_id: "name", label: "Checklist name", initial_value: field("name", checklist?.name ?? "") },
      { type: "text_input", action_id: "location", label: "Location", initial_value: field("location", checklist?.location ?? "") },
      { type: "select", action_id: "kind", label: "Shift", options: shifts, initial_value: field("kind", checklist?.kind ?? selected) },
      { type: "text_input", action_id: "tasks", label: "Tasks", placeholder: "One task per line", multiline: true, initial_value: field("tasks", checklist?.tasks.join("\n") ?? templates[template] ?? "") },
    ], submit: { label: checklist ? "Save changes" : "Create checklist", action_id: checklist ? `save:${checklist.id}:${encodeURIComponent(revision ?? "")}` : "create" } },
    actions(button("Cancel", "home")),
  ] };
}

function editAction(action: string): { id: string; revision: string } | null {
  const match = /^save:([a-f0-9-]+):(.+)$/.exec(action);
  if (!match) return null;
  try {
    const revision = decodeURIComponent(match[2]!);
    return revision.length > 0 && revision.length <= 128 ? { id: match[1]!, revision } : null;
  } catch {
    return null;
  }
}

function shiftView(shift: Shift): BlockResponse {
  const complete = shift.completedAt !== null;
  const done = shift.tasks.filter((task) => task.completedAt !== null).length;
  return { blocks: [
    { type: "header", text: shift.name },
    { type: "fields", fields: [
      { label: "Location", value: shift.location },
      { label: "Shift", value: shifts.find((item) => item.value === shift.kind)?.label ?? "Other" },
      { label: "Started", value: shift.startedAt },
      { label: "Progress", value: `${done}/${shift.tasks.length}` },
      { label: complete ? "Completed" : "In progress", value: shift.completedAt ?? shift.startedAt },
    ] },
    ...shift.tasks.map((task, index): Block => ({
      type: "section",
      text: complete ? `${task.text} — ${task.completedAt ? "Completed" : "Incomplete"}` : task.text,
      ...(!complete ? { accessory: button(task.completedAt ? "Reopen task" : "Mark complete", "task", `${shift.id}:${index}:${task.completedAt ? "0" : "1"}`) } : {}),
    })),
    ...(!complete ? [actions({ ...button("Complete shift", "finish", shift.id), confirm: { title: "Complete shift", text: "Complete this shift? Any unfinished tasks will remain incomplete in the history.", confirm: "Complete shift", deny: "Cancel" } })] : []),
    actions(button("Back", "home")),
  ] };
}

const plugin: SandboxedPlugin = {
  routes: {
    admin: {
      handler: async (routeCtx, ctx) => {
        const parsed = interaction.safeParse(routeCtx.input);
        if (!parsed.success) return { blocks: [], toast: { type: "error", message: "Check the form and try again." } };
        const checklists = ctx.storage.checklists as StorageCollection<Checklist>;
        const records = ctx.storage.shifts as StorageCollection<Shift>;
        const service = new ChecklistService(checklists, records, () => crypto.randomUUID(), () => new Date().toISOString());
        const input = parsed.data;
        const home = async (pageState?: PageState): Promise<BlockResponse> => {
          const cursor = (list: ListName) => pageState?.list === list ? pageState.cursors.at(-1) ?? undefined : undefined;
          const [list, active, completed] = await Promise.all([
            checklists.query({ where: { archived: false }, limit: 15, cursor: cursor("checklists") }),
            records.query({ where: { status: "active" }, orderBy: { startedAt: "desc" }, limit: 15, cursor: cursor("active") }),
            records.query({ where: { status: "completed" }, orderBy: { startedAt: "desc" }, limit: 15, cursor: cursor("history") }),
          ]);
          const navigation = (name: ListName, next: string | undefined): Block[] => {
            const state = pageState?.list === name ? pageState : { list: name, cursors: [null] };
            const buttons: ButtonElement[] = [];
            if (state.cursors.length > 1) buttons.push(button("Previous", "page:previous", JSON.stringify(previousPage(state))));
            if (state.cursors[0] !== null) buttons.push(button("First", "page:first", JSON.stringify({ list: name, cursors: [null] })));
            if (next) buttons.push(button("Next", "page:next", JSON.stringify(nextPage(state, next))));
            return buttons.length ? [actions(...buttons)] : [];
          };
          return { blocks: [
            { type: "header", text: "Shift checklists" }, text("Create checklists for your locations and track each shift."),
            { type: "header", text: "Checklists" },
            ...(list.items.length ? list.items.flatMap(({ data }): Block[] => [text(`${data.name} · ${data.location}`), actions(button("Edit", "edit", data.id), button("Start shift", "start", data.id), { ...button("Archive", "archive", data.id), confirm: { title: "Archive", text: "Archive this checklist? Existing shifts will remain in your history.", confirm: "Archive", deny: "Cancel" } })]) : [text("No checklists yet. Create one to get started.")]),
            ...navigation("checklists", list.cursor), actions(button("Create checklist", "new")),
            { type: "header", text: "Active shifts" },
            ...(active.items.length ? active.items.flatMap(({ data }): Block[] => [text(`${data.name} · ${data.location}`), actions(button("In progress", "view", data.id))]) : [text("No active shifts.")]),
            ...navigation("active", active.cursor), { type: "header", text: "Shift history" },
            ...(completed.items.length ? completed.items.flatMap(({ data }): Block[] => [text(`${data.name} · ${data.location} · ${data.startedAt}`), actions(button("View history", "view", data.id))]) : [text("No completed shifts yet.")]),
            ...navigation("history", completed.cursor),
          ] };
        };
        try {
          if (input.type === "page_load" || (input.type === "block_action" && input.action_id === "home")) return await home();
          if (input.type === "block_action") {
            const value = typeof input.value === "string" ? input.value : "";
            if (["page:previous", "page:next", "page:first"].includes(input.action_id)) { const state = parsePageState(value); if (!state) throw new RuleError("invalid_input"); return home(state); }
            if (input.action_id === "new") return editForm();
            if (input.action_id.startsWith("template:")) { const template = input.action_id.slice(9); if (Object.hasOwn(templates, template)) return editForm(undefined, template); }
            if (input.action_id === "edit") { const item = await checklists.getVersioned(value); if (!item) throw new MissingRecord(); return editForm(item.value, "blank", undefined, item.revision); }
            if (input.action_id === "view") { const item = await records.get(value); if (!item) throw new MissingRecord(); return shiftView(item); }
            if (input.action_id === "start") return shiftView(await service.start(value));
            if (input.action_id === "archive") { await service.archive(value); return { ...(await home()), toast: { type: "success", message: "Checklist archived." } }; }
            if (input.action_id === "finish") return shiftView(await service.finish(value));
            if (input.action_id === "task") {
              const match = /^([a-f0-9-]+):(\d+):([01])$/.exec(value);
              if (!match) throw new RuleError("invalid_input");
              return shiftView(await service.task(match[1]!, Number(match[2]), match[3] === "1"));
            }
          }
          if (input.type === "form_submit" && (input.action_id === "create" || input.action_id.startsWith("save:"))) {
            const data = form.parse(input.values);
            const values = { ...data, tasks: data.tasks.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
            if (input.action_id === "create") await service.create(values);
            else {
              const edit = editAction(input.action_id);
              if (!edit) throw new RuleError("invalid_input");
              await service.edit(edit.id, edit.revision, values);
            }
            return { ...(await home()), toast: { type: "success", message: input.action_id === "create" ? "Checklist created." : "Checklist saved." } };
          }
          return await home();
        } catch (error) {
          const message = error instanceof WriteConflict ? "This checklist changed. Open it again to review the latest version." : error instanceof RuleError && error.code === "archived" ? "This checklist is archived." : error instanceof RuleError && error.code === "completed" ? "This shift is already completed." : error instanceof MissingRecord ? (input.type === "block_action" && ["view", "finish", "task"].includes(input.action_id) ? "The shift could not be found." : "The checklist could not be found.") : error instanceof RuleError || error instanceof z.ZodError ? "Check the form and try again." : "Your changes could not be saved. Please try again.";
          if (input.type === "form_submit" && (input.action_id === "create" || input.action_id.startsWith("save:")) && (error instanceof z.ZodError || error instanceof RuleError && error.code === "invalid_input")) {
            const edit = editAction(input.action_id);
            const checklist = edit ? await checklists.get(edit.id) ?? undefined : undefined;
            return { ...editForm(checklist, "blank", input.values, edit?.revision), toast: { type: "error", message } };
          }
          return { ...(await home()), toast: { type: "error", message } };
        }
      },
    },
  },
};
export default plugin;
