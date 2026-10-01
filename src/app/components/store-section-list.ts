import { escapeHtml } from "../shell.js";

export const DEFAULT_STORE_SECTIONS = [
    "Produce",
    "Dairy",
    "Meat & seafood",
    "Bakery",
    "Frozen",
    "Pantry",
    "Beverages",
    "Household",
    "Other",
] as const;

export function renderStoreSectionList(
    sections: readonly string[] = DEFAULT_STORE_SECTIONS,
): string {
    const items = sections
        .map((name) => `<li>${escapeHtml(name)}</li>`)
        .join("");
    return `<ul class="store-section-list">${items}</ul>`;
}
