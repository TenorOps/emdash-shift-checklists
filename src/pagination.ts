export type ListName = "checklists" | "active" | "history";
export type PageState = { list: ListName; cursors: (string | null)[] };

/** Parse page state from an untrusted Block Kit action. */
export function parsePageState(value: unknown): PageState | null {
  if (typeof value !== "string" || value.length > 12_000) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || !("list" in data) || !("cursors" in data)) return null;
    if (data.list !== "checklists" && data.list !== "active" && data.list !== "history") return null;
    if (!Array.isArray(data.cursors) || data.cursors.length < 1 || data.cursors.length > 100) return null;
    if (data.cursors.some((cursor, index) => !(index === 0 && cursor === null) && (typeof cursor !== "string" || cursor.length < 1 || cursor.length > 2048))) return null;
    return { list: data.list, cursors: data.cursors as (string | null)[] };
  } catch {
    return null;
  }
}

export function nextPage(state: PageState, cursor: string): PageState {
  const cursors = [...state.cursors, cursor];
  while (cursors.length > 1 && (cursors.length > 100 || JSON.stringify({ list: state.list, cursors }).length > 12_000)) cursors.shift();
  return { ...state, cursors };
}

export function previousPage(state: PageState): PageState {
  return { ...state, cursors: state.cursors.slice(0, -1) };
}
