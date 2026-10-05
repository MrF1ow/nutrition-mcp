import { formatQuantity, isQuantityUnit } from "../../domain/quantity.js";
import type {
    Recipe,
    RecipeIngredientView,
    RecipeMacros,
} from "../../domain/recipes.js";
import {
    escapeHtml,
    renderAppShell,
    type ViewerChrome,
} from "../../app/shell.js";
import { renderFoodPicker } from "../components/food-picker.js";
import { renderMemberMultiSelect } from "../components/member-multi-select.js";
import {
    renderEmptyRecipeStore,
    renderEmptyRecipes,
    renderErrorBanner,
    renderRecipeCard,
    renderRecipeIngredientRow,
} from "../components/page-markup.js";

export type RecipeMember = { userId: string; displayName: string };
export type RecipeStoreOption = { id: string; name: string };

export type RecipesPageFilter = {
    tag: string;
    canMakeNow: boolean;
    safeFor: string;
};

export type RecipesPageView = {
    chrome: ViewerChrome;
    recipes: Recipe[];
    members: RecipeMember[];
    viewerId: string;
    filter?: RecipesPageFilter;
    error?: string;
};

export type RecipeDetailView = {
    chrome: ViewerChrome;
    recipe: Recipe;
    ingredients: RecipeIngredientView[];
    members: RecipeMember[];
    stores: RecipeStoreOption[];
    viewerId: string;
    filterUserId: string;
    portionCount: number;
    macros: RecipeMacros;
    macrosPerPortion?: RecipeMacros;
    allergenWarning?: string;
    dislikeNote?: string;
    isOwner: boolean;
    error?: string;
};

function quantityLabel(amount: number, unit: string): string {
    if (isQuantityUnit(unit)) {
        return formatQuantity({ amount, unit });
    }
    return `${amount} ${unit}`;
}

export function renderRecipesPage(view: RecipesPageView): string {
    const filter = view.filter ?? {
        tag: "",
        canMakeNow: false,
        safeFor: "",
    };
    const error = renderErrorBanner(view.error);
    const empty = view.recipes.length === 0 ? renderEmptyRecipes() : "";
    const cards = view.recipes
        .map((recipe) =>
            renderRecipeCard({
                id: recipe.id,
                name: recipe.name,
                yieldPortions: recipe.yieldPortions,
                tags: recipe.tags,
            }),
        )
        .join("");
    const memberOptions = [
        `<option value="">Anyone</option>`,
        ...view.members.map((member) => {
            const sel = member.userId === filter.safeFor ? " selected" : "";
            return `<option value="${escapeHtml(member.userId)}"${sel}>${escapeHtml(member.displayName)}</option>`;
        }),
    ].join("");
    const body = `
        <h1>Recipes</h1>
        ${error}
        <form class="recipe-list-filters" method="get" action="/recipes">
            <label for="recipe-tag">Tag</label>
            <input id="recipe-tag" name="tag" type="text" value="${escapeHtml(filter.tag)}" autocomplete="off" />
            <label class="recipe-filter-check">
                <input type="checkbox" name="can_make_now" value="1"${filter.canMakeNow ? " checked" : ""} />
                Can make now
            </label>
            <label for="recipe-safe-for">Safe for</label>
            <select id="recipe-safe-for" name="safe_for">${memberOptions}</select>
            <button type="submit">Filter</button>
        </form>
        ${empty}
        <ul class="recipe-list">${cards}</ul>
        <form class="recipe-create" method="post" action="/recipes">
            <label for="recipe-name">Name</label>
            <input id="recipe-name" name="name" type="text" required maxlength="80" autocomplete="off" />
            <label for="recipe-yield">Yield</label>
            <input id="recipe-yield" name="yield_portions" type="number" min="0" step="any" required value="4" />
            <button type="submit">Create recipe</button>
        </form>
    `;
    return renderAppShell({
        title: "Recipes",
        active: "recipes",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}

function ingredientRow(
    recipeId: string,
    ingredient: RecipeIngredientView,
): string {
    return renderRecipeIngredientRow({
        id: ingredient.id,
        recipeId,
        displayName: ingredient.displayName,
        totalLabel: quantityLabel(
            ingredient.quantity.amount,
            ingredient.quantity.unit,
        ),
        perPortionLabel: quantityLabel(
            ingredient.perPortionAmount,
            ingredient.quantity.unit,
        ),
        personLabel: quantityLabel(
            ingredient.personAmount,
            ingredient.quantity.unit,
        ),
        perPortionAmount: ingredient.perPortionAmount,
        personAmount: ingredient.personAmount,
        totalAmount: ingredient.quantity.amount,
        note: ingredient.note,
    });
}

function macrosBlock(
    macros: RecipeMacros,
    scope: "portion" | "person",
): string {
    const label = scope === "portion" ? "Per portion" : "This portion";
    const reasons =
        macros.incompleteReasons.length > 0
            ? `<ul class="recipe-macros-reasons">${macros.incompleteReasons
                  .map((reason) => `<li>${escapeHtml(reason)}</li>`)
                  .join("")}</ul>`
            : "";
    if (macros.incomplete && macros.calories == null) {
        return `<p class="recipe-macros" data-scope="${scope}" data-incomplete="true">${escapeHtml(label)}: Macros incomplete</p>${reasons}`;
    }
    const incomplete = macros.incomplete
        ? `<p class="recipe-macros-incomplete">${escapeHtml(label)}: Macros incomplete</p>`
        : "";
    return `<p class="recipe-macros" data-scope="${scope}" data-incomplete="${macros.incomplete ? "true" : "false"}" data-calories="${escapeHtml(String(macros.calories ?? ""))}" data-protein="${escapeHtml(String(macros.protein_g ?? ""))}">${escapeHtml(label)}: Calories ${escapeHtml(String(macros.calories ?? "—"))} · Protein ${escapeHtml(String(macros.protein_g ?? "—"))} g · Carbs ${escapeHtml(String(macros.carbs_g ?? "—"))} g · Fat ${escapeHtml(String(macros.fat_g ?? "—"))} g</p>${incomplete}${reasons}`;
}

export function renderRecipeDetailPage(view: RecipeDetailView): string {
    const error = renderErrorBanner(view.error);
    const allergen = view.allergenWarning
        ? `<p class="allergen-warning" data-blocking="true">${escapeHtml(view.allergenWarning)}</p>`
        : "";
    const dislike = view.dislikeNote
        ? `<p class="dislike-note">${escapeHtml(view.dislikeNote)}</p>`
        : "";
    const rows = view.ingredients
        .map((ingredient) => ingredientRow(view.recipe.id, ingredient))
        .join("");
    const viewingSelf = view.filterUserId === view.viewerId;
    const memberOptions = view.members
        .map((member) => {
            const sel = member.userId === view.filterUserId ? " selected" : "";
            return `<option value="${escapeHtml(member.userId)}"${sel}>${escapeHtml(member.displayName)}</option>`;
        })
        .join("");
    const portion = viewingSelf
        ? `<form class="recipe-portion" method="post" action="/recipes/${escapeHtml(view.recipe.id)}/portions">
<label for="portion-count">Your portion</label>
<input id="portion-count" name="portion_count" type="number" min="0" step="any" required value="${escapeHtml(String(view.portionCount))}" />
<button type="submit">Save portion</button>
</form>`
        : `<p class="person-portion" data-portion-count="${escapeHtml(String(view.portionCount))}" data-readonly="true">Portion ${escapeHtml(String(view.portionCount))}</p>`;
    const storeOptions = view.stores
        .map(
            (store) =>
                `<option value="${escapeHtml(store.id)}">${escapeHtml(store.name)}</option>`,
        )
        .join("");
    const grocery =
        view.stores.length === 0
            ? renderEmptyRecipeStore()
            : `<form class="recipe-add-grocery" method="post" action="/recipes/${escapeHtml(view.recipe.id)}/add-to-grocery">
${renderMemberMultiSelect(view.members, [view.viewerId])}
<label for="recipe-store">Store</label>
<select id="recipe-store" name="store_id" required>${storeOptions}</select>
<button type="submit">Add to grocery</button>
</form>`;
    const recipeId = escapeHtml(view.recipe.id);
    const personMacros =
        view.portionCount === 1 ? "" : macrosBlock(view.macros, "person");
    const perPortion = view.macrosPerPortion ?? view.macros;
    const tagsValue = escapeHtml(view.recipe.tags.join(", "));
    const body = `
        <p class="recipe-back"><a href="/recipes">Recipes</a></p>
        <h1>${escapeHtml(view.recipe.name)}</h1>
        ${error}
        ${allergen}
        ${dislike}
        <p class="recipe-yield" data-yield="${escapeHtml(String(view.recipe.yieldPortions))}">Yield ${escapeHtml(String(view.recipe.yieldPortions))}</p>
        <form class="recipe-edit" method="post" action="/recipes/${recipeId}">
            <label for="edit-name">Name</label>
            <input id="edit-name" name="name" type="text" required maxlength="80" value="${escapeHtml(view.recipe.name)}" />
            <label for="edit-yield">Yield</label>
            <input id="edit-yield" name="yield_portions" type="number" min="0" step="any" required value="${escapeHtml(String(view.recipe.yieldPortions))}" />
            <label for="edit-source">Source URL</label>
            <input id="edit-source" name="source_url" type="text" value="${escapeHtml(view.recipe.sourceUrl ?? "")}" />
            <label for="edit-tags">Tags</label>
            <input id="edit-tags" name="tags" type="text" value="${tagsValue}" placeholder="dinner, vegetarian" />
            <label for="edit-prep">Prep minutes</label>
            <input id="edit-prep" name="prep_minutes" type="number" min="0" step="1" value="${escapeHtml(view.recipe.prepMinutes == null ? "" : String(view.recipe.prepMinutes))}" />
            <label for="edit-cook">Cook minutes</label>
            <input id="edit-cook" name="cook_minutes" type="number" min="0" step="1" value="${escapeHtml(view.recipe.cookMinutes == null ? "" : String(view.recipe.cookMinutes))}" />
            <label for="edit-instructions">Instructions</label>
            <textarea id="edit-instructions" name="instructions" rows="8">${escapeHtml(view.recipe.instructions ?? "")}</textarea>
            <label for="edit-notes">Notes</label>
            <textarea id="edit-notes" name="notes" rows="3">${escapeHtml(view.recipe.notes ?? "")}</textarea>
            <button type="submit">Save recipe</button>
        </form>
        <form class="recipe-filter" method="get" action="/recipes/${recipeId}" data-filter-member="${escapeHtml(view.filterUserId)}">
            <label for="recipe-member">Filter by person</label>
            <select id="recipe-member" name="member">${memberOptions}</select>
            <button type="submit">View</button>
        </form>
        ${portion}
        ${macrosBlock(perPortion, "portion")}
        ${personMacros}
        <form class="recipe-log-portion" method="post" action="/recipes/${recipeId}/log-portion">
            <label for="log-portion-count">Portions</label>
            <input id="log-portion-count" name="portions" type="number" min="0" step="any" required value="${escapeHtml(String(view.portionCount))}" />
            <label for="log-portion-type">Meal type</label>
            <select id="log-portion-type" name="meal_type">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack" selected>Snack</option>
            </select>
            <button type="submit">Log a portion</button>
        </form>
        <form class="recipe-cook" method="post" action="/recipes/${recipeId}/cook">
            <fieldset>
                <legend>Cooked it</legend>
                ${view.members
                    .map((member) => {
                        const value =
                            member.userId === view.viewerId
                                ? String(view.portionCount)
                                : "1";
                        return `<label for="cook-portion-${escapeHtml(member.userId)}">${escapeHtml(member.displayName)}</label>
<input id="cook-portion-${escapeHtml(member.userId)}" name="portion:${escapeHtml(member.userId)}" type="number" min="0" step="any" value="${escapeHtml(value)}" />`;
                    })
                    .join("")}
                <label for="cook-meal-type">Meal type</label>
                <select id="cook-meal-type" name="meal_type">
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner" selected>Dinner</option>
                    <option value="snack">Snack</option>
                </select>
                <label><input type="checkbox" name="deduct_stock" value="1" checked /> Deduct stock</label>
                <label><input type="checkbox" name="log_meals" value="1" checked /> Log meals</label>
                <button type="submit">Cooked it</button>
            </fieldset>
        </form>
        <ul class="recipe-ingredients">${rows}</ul>
        <h2>Add ingredient</h2>
        ${renderFoodPicker({
            id: "recipe-picker",
            action: `/recipes/${view.recipe.id}/ingredients`,
            method: "post",
            includeQuantity: true,
        })}
        ${grocery}
        <form class="recipe-delete" method="post" action="/recipes/${recipeId}/delete">
            <button type="submit">Delete recipe</button>
        </form>
    `;
    return renderAppShell({
        title: view.recipe.name,
        active: "recipes",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}
