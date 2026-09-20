import { formatQuantity } from "../../quantity.js";
import type {
    Recipe,
    RecipeIngredientView,
    RecipeMacros,
} from "../../recipes.js";
import { escapeHtml, renderAppShell, type ViewerChrome } from "../shell.js";
import { renderFoodPicker } from "../components/food-picker.js";
import { renderMemberMultiSelect } from "../components/member-multi-select.js";

export type RecipeMember = { userId: string; displayName: string };
export type RecipeStoreOption = { id: string; name: string };

export type RecipesPageView = {
    chrome: ViewerChrome;
    recipes: Recipe[];
    members: RecipeMember[];
    viewerId: string;
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
    allergenWarning?: string;
    dislikeNote?: string;
    isOwner: boolean;
    error?: string;
};

function gramsLabel(amount: number): string {
    return formatQuantity({ amount, unit: "g" });
}

export function renderRecipesPage(view: RecipesPageView): string {
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const empty =
        view.recipes.length === 0
            ? `<p class="empty-recipes">Add a recipe.</p>`
            : "";
    const cards = view.recipes
        .map(
            (recipe) =>
                `<li class="recipe-card" data-recipe-id="${escapeHtml(recipe.id)}">
<a href="/recipes/${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</a>
<p class="recipe-yield">Yield ${escapeHtml(String(recipe.yieldPortions))}</p>
</li>`,
        )
        .join("");
    const body = `
        <h1>Recipes</h1>
        ${error}
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

function ingredientRow(ingredient: RecipeIngredientView): string {
    return `<li class="recipe-ingredient" data-ingredient-id="${escapeHtml(ingredient.id)}" data-per-portion="${escapeHtml(String(ingredient.perPortionAmount))}" data-person-amount="${escapeHtml(String(ingredient.personAmount))}">
<p class="recipe-ingredient-name">${escapeHtml(ingredient.displayName)}</p>
<p class="recipe-ingredient-total">Total ${escapeHtml(gramsLabel(ingredient.quantity.amount))}</p>
<p class="recipe-ingredient-per-portion">Per portion ${escapeHtml(gramsLabel(ingredient.perPortionAmount))}</p>
<p class="recipe-ingredient-person">${escapeHtml(gramsLabel(ingredient.personAmount))}</p>
</li>`;
}

function macrosBlock(macros: RecipeMacros): string {
    if (macros.incomplete && macros.calories == null) {
        return `<p class="recipe-macros" data-incomplete="true">Macros incomplete</p>`;
    }
    const incomplete = macros.incomplete
        ? `<p class="recipe-macros-incomplete">Macros incomplete</p>`
        : "";
    return `<p class="recipe-macros" data-incomplete="${macros.incomplete ? "true" : "false"}" data-calories="${escapeHtml(String(macros.calories ?? ""))}" data-protein="${escapeHtml(String(macros.protein_g ?? ""))}">Calories ${escapeHtml(String(macros.calories ?? "—"))} · Protein ${escapeHtml(String(macros.protein_g ?? "—"))} g · Carbs ${escapeHtml(String(macros.carbs_g ?? "—"))} g · Fat ${escapeHtml(String(macros.fat_g ?? "—"))} g</p>${incomplete}`;
}

export function renderRecipeDetailPage(view: RecipeDetailView): string {
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const allergen = view.allergenWarning
        ? `<p class="allergen-warning" data-blocking="true">${escapeHtml(view.allergenWarning)}</p>`
        : "";
    const dislike = view.dislikeNote
        ? `<p class="dislike-note">${escapeHtml(view.dislikeNote)}</p>`
        : "";
    const rows = view.ingredients.map(ingredientRow).join("");
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
            ? `<p class="empty-recipe-store">Add a grocery store in Settings, then add this recipe to the list.</p>`
            : `<form class="recipe-add-grocery" method="post" action="/recipes/${escapeHtml(view.recipe.id)}/add-to-grocery">
${renderMemberMultiSelect(view.members, [view.viewerId])}
<label for="recipe-store">Store</label>
<select id="recipe-store" name="store_id" required>${storeOptions}</select>
<button type="submit">Add to grocery</button>
</form>`;
    const body = `
        <p class="recipe-back"><a href="/recipes">Recipes</a></p>
        <h1>${escapeHtml(view.recipe.name)}</h1>
        ${error}
        ${allergen}
        ${dislike}
        <p class="recipe-yield" data-yield="${escapeHtml(String(view.recipe.yieldPortions))}">Yield ${escapeHtml(String(view.recipe.yieldPortions))}</p>
        <form class="recipe-filter" method="get" action="/recipes/${escapeHtml(view.recipe.id)}" data-filter-member="${escapeHtml(view.filterUserId)}">
            <label for="recipe-member">Filter by person</label>
            <select id="recipe-member" name="member">${memberOptions}</select>
            <button type="submit">View</button>
        </form>
        ${portion}
        ${macrosBlock(view.macros)}
        <ul class="recipe-ingredients">${rows}</ul>
        <h2>Add ingredient</h2>
        ${renderFoodPicker({
            id: "recipe-picker",
            action: `/recipes/${view.recipe.id}/ingredients`,
            method: "post",
            includeQuantity: true,
        })}
        ${grocery}
        <form class="recipe-delete" method="post" action="/recipes/${escapeHtml(view.recipe.id)}/delete">
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
