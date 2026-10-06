import {
    escapeHtml,
    renderAppShell,
    type ViewerChrome,
} from "../../app/shell.js";
import { ALLERGEN_LABELS, NAMED_ALLERGENS } from "../../domain/rules.js";
import type { Food } from "../../domain/foods.js";

export type FoodsSettingsView = {
    chrome: ViewerChrome;
    foods: Array<Food & { aliases: string[] }>;
    error?: string;
};

function nutrientInput(
    id: string,
    name: string,
    label: string,
    value: number | null,
): string {
    return `<label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
<input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="number" min="0" step="0.1" value="${value == null ? "" : escapeHtml(String(value))}" />`;
}

function foodCard(food: Food & { aliases: string[] }): string {
    const allergenBoxes = [...NAMED_ALLERGENS, "other" as const]
        .map((code) => {
            const checked = food.allergens.includes(code) ? " checked" : "";
            return `<label><input type="checkbox" name="allergens" value="${escapeHtml(code)}"${checked} /> ${escapeHtml(ALLERGEN_LABELS[code])}</label>`;
        })
        .join("");
    const archived = food.archivedAt ? " checked" : "";
    return `<form method="post" action="/settings/foods/${escapeHtml(food.id)}" class="appearance food-edit panel">
<input type="hidden" name="food_id" value="${escapeHtml(food.id)}" />
<fieldset>
<legend>${escapeHtml(food.name)}</legend>
<label for="name-${escapeHtml(food.id)}">Name</label>
<input id="name-${escapeHtml(food.id)}" name="name" value="${escapeHtml(food.name)}" required maxlength="120" />
<label for="brand-${escapeHtml(food.id)}">Brand</label>
<input id="brand-${escapeHtml(food.id)}" name="brand" value="${escapeHtml(food.brand ?? "")}" maxlength="80" />
<label for="aliases-${escapeHtml(food.id)}">Aliases</label>
<input id="aliases-${escapeHtml(food.id)}" name="aliases" value="${escapeHtml(food.aliases.join(", "))}" />
<label for="unit-${escapeHtml(food.id)}">Default unit</label>
<input id="unit-${escapeHtml(food.id)}" name="default_unit" value="${escapeHtml(food.defaultUnit)}" />
${nutrientInput(`each-${food.id}`, "grams_per_each", "Grams per each", food.gramsPerEach)}
${nutrientInput(`ml-${food.id}`, "grams_per_ml", "Grams per millilitre", food.gramsPerMl)}
${nutrientInput(`cal-${food.id}`, "calories", "Calories / 100 g", food.calories)}
${nutrientInput(`pro-${food.id}`, "protein_g", "Protein g", food.proteinG)}
${nutrientInput(`carb-${food.id}`, "carbs_g", "Carbs g", food.carbsG)}
${nutrientInput(`fat-${food.id}`, "fat_g", "Fat g", food.fatG)}
${nutrientInput(`fib-${food.id}`, "fiber_g", "Fiber g", food.fiberG)}
${nutrientInput(`sug-${food.id}`, "sugar_g", "Sugar g", food.sugarG)}
${nutrientInput(`alc-${food.id}`, "alcohol_g", "Alcohol g", food.alcoholG)}
${nutrientInput(`caf-${food.id}`, "caffeine_mg", "Caffeine mg", food.caffeineMg)}
<fieldset class="allergens"><legend>Allergens</legend>${allergenBoxes}</fieldset>
<label><input type="checkbox" name="archived" value="1"${archived} /> Archived</label>
<button type="submit">Save food</button>
</fieldset>
</form>`;
}

export function renderFoodsSettingsPage(view: FoodsSettingsView): string {
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const list = view.foods.map(foodCard).join("");
    const options = view.foods
        .map(
            (food) =>
                `<option value="${escapeHtml(food.id)}">${escapeHtml(food.name)}</option>`,
        )
        .join("");
    const merge =
        view.foods.length >= 2
            ? `<form method="post" action="/settings/foods/merge" class="appearance panel">
<fieldset>
<legend>Merge foods</legend>
<label for="keep_id">Keep</label>
<select id="keep_id" name="keep_id">${options}</select>
<label for="drop_id">Drop</label>
<select id="drop_id" name="drop_id">${options}</select>
<button type="submit">Merge</button>
</fieldset>
</form>`
            : "";
    const body = `
        <h1>Foods</h1>
        <p class="settings-lead"><a href="/settings">Account</a> · <a href="/settings/household">Household</a></p>
        ${error}
        ${list || `<p class="empty">No foods in the catalog yet.</p>`}
        ${merge}
    `;
    return renderAppShell({
        title: "Foods",
        active: "settings",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}
