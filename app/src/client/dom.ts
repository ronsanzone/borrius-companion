/** DOM boundary helpers validate node kinds rather than asserting selector results. */
export function element(
  selector: string,
  root: Pick<Document, "querySelector"> | HTMLElement = document,
): HTMLElement {
  const result = root.querySelector(selector);
  if (!(result instanceof HTMLElement)) throw new Error(`Missing interface element: ${selector}`);
  return result;
}
export function control(
  target: EventTarget | null,
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
    ? target
    : null;
}
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Browser and promise exceptions enter this error-display boundary as unknown.
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
}
const entities = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
]);
export function esc(value: string | number | boolean | null | undefined): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => entities.get(character) ?? character,
  );
}
export function dialog(): HTMLDialogElement {
  const result = document.querySelector("#detail");
  if (!(result instanceof HTMLDialogElement)) throw new Error("Missing Pokémon summary dialog.");
  return result;
}
