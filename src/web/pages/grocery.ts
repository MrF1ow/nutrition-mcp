import {
    formatQuantity,
    isQuantityUnit,
    type Quantity,
} from "../../domain/quantity.js";
import type { GroceryLine } from "../../domain/grocery.js";
import type { GrocerySection, GroceryStore } from "../../domain/settings.js";
import type { StoreRule } from "../../domain/rules.js";
import type { AlreadyHaveTag } from "../../domain/linking.js";
import {
    escapeHtml,
    renderAppShell,
    type ViewerChrome,
} from "../../app/shell.js";
import { renderAlreadyHaveTag } from "../components/already-have-tag.js";
import { renderFoodPicker } from "../components/food-picker.js";
import {
    renderEmptyGrocery,
    renderErrorBanner,
    renderGroceryLineRow,
} from "../components/page-markup.js";

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
    isOwner?: boolean;
    error?: string;
    allergenWarning?: string;
    unknownAllergen?: boolean;
};

function quantityLabel(line: GroceryLine): string {
    if (isQuantityUnit(line.quantity.unit)) {
        return formatQuantity({
            amount: line.quantity.amount,
            unit: line.quantity.unit,
        });
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
    return renderGroceryLineRow({
        id: line.id,
        kind: line.kind,
        checked: line.checked,
        displayName: line.displayName,
        quantityLabel: quantityLabel(line),
        alreadyHaveHtml: alreadyHaveHtml(line.alreadyHave),
    });
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
</section>`;
}

export function renderGroceryPage(view: GroceryPageView): string {
    const error = renderErrorBanner(view.error);
    const allergen = view.allergenWarning
        ? `<p class="allergen-warning" data-blocking="true">${escapeHtml(view.allergenWarning)}</p>`
        : view.unknownAllergen
          ? `<p class="allergen-unknown">unknown allergen data</p>`
          : "";
    const empty = view.stores.length === 0 ? renderEmptyGrocery() : "";
    const addStore = view.isOwner
        ? `<form class="grocery-add-store" method="post" action="/grocery/stores">
<label for="grocery_store_name">Grocery store</label>
<input id="grocery_store_name" name="name" maxlength="80" autocomplete="off" />
<button type="submit">Add store</button>
</form>`
        : "";
    const stores = view.stores.map(storeSection).join("");
    const body = `
        <h1>Groceries</h1>
        ${error}
        ${allergen}
        ${addStore}
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
