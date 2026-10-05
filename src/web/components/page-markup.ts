import { escapeHtml } from "../../app/shell.js";

export function renderErrorBanner(error?: string): string {
    return error ? `<p class="error-banner">${escapeHtml(error)}</p>` : "";
}

export function renderEmptyGrocery(): string {
    return `<p class="empty-grocery">Add a grocery store in Settings, then add a line.</p>
<p><a href="/settings/household">Household settings</a></p>`;
}

export function renderEmptyFridge(): string {
    return `<p class="empty-fridge">Add a location, then add an item.</p>`;
}

export function renderEmptyRecipes(): string {
    return `<p class="empty-recipes">Add a recipe.</p>`;
}

export function renderEmptyRecipeStore(): string {
    return `<p class="empty-recipe-store">Add a grocery store in Settings, then add this recipe to the list.</p>`;
}

export function renderAddItemPrompt(locationName: string): string {
    return `<p class="add-item-prompt">Add an item to ${escapeHtml(locationName)}.</p>`;
}

export function renderGroceryLineRow(opts: {
    id: string;
    kind: string;
    checked: boolean;
    displayName: string;
    quantityLabel: string;
    alreadyHaveHtml: string;
}): string {
    const checked = opts.checked ? "true" : "false";
    const next = opts.checked ? "0" : "1";
    return `<li class="grocery-line${opts.checked ? " is-checked" : ""}" data-line-id="${escapeHtml(opts.id)}" data-checked="${checked}" data-kind="${opts.kind}">
<div class="grocery-line-head">
<p class="grocery-line-name">${escapeHtml(opts.displayName)}</p>
<p class="grocery-line-qty">${escapeHtml(opts.quantityLabel)}</p>
${opts.alreadyHaveHtml}
</div>
<form class="grocery-line-check" method="post" action="/grocery/lines/${escapeHtml(opts.id)}/check">
<input type="hidden" name="checked" value="${next}" />
<button type="submit">${opts.checked ? "Checked" : "Check"}</button>
</form>
</li>`;
}

export function renderFridgeItemRow(opts: {
    id: string;
    kind: string;
    displayName: string;
    quantityLabel: string;
    editFields: string;
}): string {
    return `<li class="fridge-item" data-item-id="${escapeHtml(opts.id)}" data-kind="${opts.kind}">
<div class="fridge-item-head">
<p class="fridge-item-name">${escapeHtml(opts.displayName)}</p>
<p class="fridge-item-qty">${escapeHtml(opts.quantityLabel)}</p>
</div>
<form class="fridge-item-edit" method="post" action="/fridge/items/${escapeHtml(opts.id)}">
${opts.editFields}
<button type="submit">Save</button>
</form>
<form class="fridge-item-delete" method="post" action="/fridge/items/${escapeHtml(opts.id)}/delete">
<button type="submit">Delete</button>
</form>
</li>`;
}

export function renderRecipeCard(opts: {
    id: string;
    name: string;
    yieldPortions: number;
}): string {
    return `<li class="recipe-card" data-recipe-id="${escapeHtml(opts.id)}">
<a href="/recipes/${escapeHtml(opts.id)}">${escapeHtml(opts.name)}</a>
<p class="recipe-yield">Yield ${escapeHtml(String(opts.yieldPortions))}</p>
</li>`;
}

export function renderRecipeIngredientRow(opts: {
    id: string;
    displayName: string;
    totalLabel: string;
    perPortionLabel: string;
    personLabel: string;
    perPortionAmount: number;
    personAmount: number;
}): string {
    return `<li class="recipe-ingredient" data-ingredient-id="${escapeHtml(opts.id)}" data-per-portion="${escapeHtml(String(opts.perPortionAmount))}" data-person-amount="${escapeHtml(String(opts.personAmount))}">
<p class="recipe-ingredient-name">${escapeHtml(opts.displayName)}</p>
<p class="recipe-ingredient-total">Total ${escapeHtml(opts.totalLabel)}</p>
<p class="recipe-ingredient-per-portion">Per portion ${escapeHtml(opts.perPortionLabel)}</p>
<p class="recipe-ingredient-person">${escapeHtml(opts.personLabel)}</p>
</li>`;
}
