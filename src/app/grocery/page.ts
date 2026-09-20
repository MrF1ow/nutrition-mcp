import { formatQuantity, type Quantity } from "../../quantity.js";
import type { GroceryLine } from "../../grocery.js";
import type { GrocerySection, GroceryStore } from "../../settings.js";
import type { StoreRule } from "../../rules.js";
import type { AlreadyHaveTag } from "../../linking.js";
import { escapeHtml, renderAppShell, type ViewerChrome } from "../shell.js";
import { renderAlreadyHaveTag } from "../components/already-have-tag.js";
import { renderFoodPicker } from "../components/food-picker.js";
import { renderQuantityField } from "../components/quantity-field.js";

const SUPPLY_UNITS = [
    "roll",
    "each",
    "box",
    "pack",
    "g",
    "oz",
    "lb",
    "ml",
    "fl oz",
    "cup",
] as const;

export type GroceryLineView = GroceryLine & {
    alreadyHave: AlreadyHaveTag | null;
};

export type GrocerySectionView = GrocerySection & {
    lines: GroceryLineView[];
};

export type GroceryStoreView = GroceryStore & {
    sections: GrocerySectionView[];
    rules: StoreRule[];
};

export type GroceryPageView = {
    chrome: ViewerChrome;
    stores: GroceryStoreView[];
    error?: string;
    allergenWarning?: string;
    unknownAllergen?: boolean;
};

function quantityLabel(line: GroceryLine): string {
    if (line.kind === "food") {
        return formatQuantity({ amount: line.quantity.amount, unit: "g" });
    }
    return `${line.quantity.amount} ${line.quantity.unit}`;
}

function storeSectionSelect(store: GroceryStoreView): string {
    const options = store.sections
        .filter((section) => !section.hidden || section.isOther)
        .map((section) => {
            const sel = section.isOther ? " selected" : "";
            return `<option value="${escapeHtml(section.id)}"${sel}>${escapeHtml(section.name)}</option>`;
        })
        .join("");
    return `<label for="section-${escapeHtml(store.id)}">Section</label>
<select id="section-${escapeHtml(store.id)}" data-grocery-section>${options}</select>`;
}

function alreadyHaveHtml(tag: AlreadyHaveTag | null): string {
    if (tag == null) return "";
    if (tag.cover === "full") return renderAlreadyHaveTag({ cover: "full" });
    return renderAlreadyHaveTag({
        cover: "partial",
        have: tag.have as Quantity,
        need: tag.need as Quantity,
    });
}

function lineRow(line: GroceryLineView): string {
    const checked = line.checked ? "true" : "false";
    const next = line.checked ? "0" : "1";
    return `<li class="grocery-line${line.checked ? " is-checked" : ""}" data-line-id="${escapeHtml(line.id)}" data-checked="${checked}" data-kind="${line.kind}">
<div class="grocery-line-head">
<p class="grocery-line-name">${escapeHtml(line.displayName)}</p>
<p class="grocery-line-qty">${escapeHtml(quantityLabel(line))}</p>
${alreadyHaveHtml(line.alreadyHave)}
</div>
<form class="grocery-line-check" method="post" action="/grocery/lines/${escapeHtml(line.id)}/check">
<input type="hidden" name="checked" value="${next}" />
<button type="submit">${line.checked ? "Checked" : "Check"}</button>
</form>
</li>`;
}

function storeSection(store: GroceryStoreView): string {
    const rules = store.rules
        .map((rule) => `<li class="store-rule">${escapeHtml(rule.body)}</li>`)
        .join("");
    const sections = store.sections
        .filter((section) => section.lines.length > 0)
        .map((section) => {
            const rows = section.lines.map(lineRow).join("");
            return `<section class="grocery-section" data-section-id="${escapeHtml(section.id)}" data-section-name="${escapeHtml(section.name)}">
<h3>${escapeHtml(section.name)}</h3>
<ul class="grocery-lines">${rows}</ul>
</section>`;
        })
        .join("");
    const pickerId = `picker-${store.id}`;
    const other = store.sections.find((section) => section.isOther);
    const hidden: Record<string, string> = {
        kind: "food",
        store_id: store.id,
    };
    if (other) hidden.section_id = other.id;
    return `<section class="grocery-store" data-store-id="${escapeHtml(store.id)}">
<h2>${escapeHtml(store.name)}</h2>
${rules ? `<ul class="store-rule-list">${rules}</ul>` : ""}
${sections}
${storeSectionSelect(store)}
<h3>Add food</h3>
${renderFoodPicker({
    id: pickerId,
    action: "/grocery/lines",
    method: "post",
    hiddenFields: hidden,
    includeQuantity: true,
})}
<h3>Add supply</h3>
<form class="grocery-add-supply" method="post" action="/grocery/lines">
<input type="hidden" name="kind" value="supply" />
<input type="hidden" name="store_id" value="${escapeHtml(store.id)}" />
${other ? `<input type="hidden" name="section_id" value="${escapeHtml(other.id)}" />` : ""}
<label for="supply-name-${escapeHtml(store.id)}">Name</label>
<input id="supply-name-${escapeHtml(store.id)}" name="name" type="text" required autocomplete="off" />
${renderQuantityField({
    kind: "supply",
    unit: "roll",
    units: SUPPLY_UNITS,
    idPrefix: `supply-qty-${store.id}`,
    namePrefix: "qty",
    required: true,
})}
<button type="submit">Add supply</button>
</form>
</section>`;
}

export function renderGroceryPage(view: GroceryPageView): string {
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const allergen = view.allergenWarning
        ? `<p class="allergen-warning" data-blocking="true">${escapeHtml(view.allergenWarning)}</p>`
        : view.unknownAllergen
          ? `<p class="allergen-unknown">unknown allergen data</p>`
          : "";
    const empty =
        view.stores.length === 0
            ? `<p class="empty-grocery">Add a grocery store in Settings, then add a line.</p>
<p><a href="/settings/household">Household settings</a></p>`
            : "";
    const stores = view.stores.map(storeSection).join("");
    const body = `
        <h1>Groceries</h1>
        ${error}
        ${allergen}
        ${empty}
        <form class="grocery-clear-checked" method="post" action="/grocery/clear-checked">
            <button type="submit">Clear checked</button>
        </form>
        ${stores}
        <script>
(function () {
    document.querySelectorAll(".grocery-store").forEach(function (store) {
        var select = store.querySelector("[data-grocery-section]");
        if (!select) return;
        store.querySelectorAll("form").forEach(function (form) {
            form.addEventListener("submit", function () {
                var existing = form.querySelector('input[name="section_id"]');
                if (existing) existing.value = select.value;
                else {
                    var input = document.createElement("input");
                    input.type = "hidden";
                    input.name = "section_id";
                    input.value = select.value;
                    form.appendChild(input);
                }
            });
        });
    });
})();
        </script>
    `;
    return renderAppShell({
        title: "Groceries",
        active: "grocery",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}
