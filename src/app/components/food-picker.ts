import { searchFoodsByName } from "../../food-search.js";
import {
    lookupBarcode,
    normalizeBarcode,
    type FoodResult,
} from "../../foods.js";
import { escapeHtml } from "../shell.js";
import { renderQuantityField } from "./quantity-field.js";

export const PICKER_DEMO_FOODS = [
    {
        name: "Good Culture Cottage Cheese",
        brand: "Good Culture",
        barcode: "070852010016",
    },
    {
        name: "Organic Cottage Cheese",
        brand: "Nancy's",
        barcode: "072830001234",
    },
    {
        name: "Nutella",
        brand: "Ferrero",
        barcode: "3017620422003",
    },
] as const;

type SearchHooks = Parameters<typeof searchFoodsByName>[2];

export async function searchPickerFoods(
    query: string,
    householdNames: string[] = [],
    hooks: SearchHooks = {},
): Promise<FoodResult[]> {
    return searchFoodsByName(query, householdNames, hooks);
}

export async function runBarcodeLookupAction(
    raw: string,
    opts: {
        lookup?: (barcode: string) => Promise<FoodResult | null>;
    } = {},
): Promise<{ barcode: string; food: FoodResult | null } | { error: string }> {
    const barcode = normalizeBarcode(raw);
    if (!barcode) return { error: "invalid barcode" };
    const lookup = opts.lookup ?? lookupBarcode;
    const food = await lookup(barcode);
    return { barcode, food };
}

function pickerScript(id: string): string {
    return `<script>
(function () {
    var root = document.getElementById(${JSON.stringify(id)});
    if (!root) return;
    var tabs = root.querySelectorAll('[role="tab"]');
    var panels = root.querySelectorAll('[role="tabpanel"]');
    function show(name) {
        tabs.forEach(function (tab) {
            var on = tab.getAttribute("data-tab") === name;
            tab.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute("data-panel") !== name;
        });
    }
    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            show(tab.getAttribute("data-tab"));
        });
    });
    var catalogEl = root.querySelector("[data-demo-foods]");
    var foods = catalogEl ? JSON.parse(catalogEl.textContent || "[]") : [];
    var searchInput = root.querySelector("[data-search-input]");
    var searchResults = root.querySelector("[data-search-results]");
    function renderHits(target, hits) {
        if (!target) return;
        target.innerHTML = hits.map(function (food) {
            var label = food.brand ? food.brand + " · " + food.name : food.name;
            return "<li>" + label + "</li>";
        }).join("");
    }
    if (searchInput && searchResults) {
        searchInput.addEventListener("input", function () {
            var q = String(searchInput.value || "").trim().toLowerCase();
            if (!q) {
                searchResults.innerHTML = "";
                return;
            }
            renderHits(searchResults, foods.filter(function (food) {
                return (food.name + " " + (food.brand || "")).toLowerCase().indexOf(q) !== -1;
            }));
        });
    }
    var form = root.querySelector("[data-barcode-form]");
    var barcodeResults = root.querySelector("[data-barcode-results]");
    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var input = form.querySelector('input[name="barcode"]');
            var digits = String(input && input.value ? input.value : "").replace(/\\D/g, "");
            form.setAttribute("data-lookup-called", "lookupBarcode");
            if (barcodeResults) {
                barcodeResults.setAttribute("data-lookup-path", "lookupBarcode");
            }
            if (digits.length < 8 || digits.length > 14) {
                if (barcodeResults) barcodeResults.innerHTML = "<li>Invalid barcode</li>";
                return;
            }
            if (barcodeResults) barcodeResults.setAttribute("data-barcode", digits);
            var hit = foods.filter(function (food) { return food.barcode === digits; })[0];
            if (barcodeResults) {
                barcodeResults.innerHTML = hit
                    ? '<li data-source="lookupBarcode">' + hit.name + "</li>"
                    : '<li data-source="lookupBarcode">Unknown barcode ' + digits + "</li>";
            }
        });
    }
})();
</script>`;
}

export function renderFoodPicker(opts: { id?: string } = {}): string {
    const id = opts.id ?? "food-picker";
    const catalog = JSON.stringify(PICKER_DEMO_FOODS).replace(/</g, "\\u003c");
    const barcodePanel = `${id}-barcode`;
    const searchPanel = `${id}-search`;
    const manualPanel = `${id}-manual`;
    return `<div class="food-picker" id="${escapeHtml(id)}" data-food-picker>
<div class="food-picker-tabs" role="tablist" aria-label="Food identity">
<button type="button" role="tab" id="${escapeHtml(id)}-tab-barcode" data-tab="barcode" aria-controls="${escapeHtml(barcodePanel)}" aria-selected="true">Barcode</button>
<button type="button" role="tab" id="${escapeHtml(id)}-tab-search" data-tab="search" aria-controls="${escapeHtml(searchPanel)}" aria-selected="false">Search</button>
<button type="button" role="tab" id="${escapeHtml(id)}-tab-manual" data-tab="manual" aria-controls="${escapeHtml(manualPanel)}" aria-selected="false">Manual</button>
</div>
<div class="food-picker-panel" role="tabpanel" id="${escapeHtml(barcodePanel)}" data-panel="barcode" aria-labelledby="${escapeHtml(id)}-tab-barcode">
<form class="food-picker-barcode" data-barcode-form data-lookup-path="lookupBarcode" action="#" method="get">
<label for="${escapeHtml(id)}-barcode">Barcode</label>
<input id="${escapeHtml(id)}-barcode" name="barcode" inputmode="numeric" pattern="[0-9]*" autocomplete="off" />
<button type="submit">Look up</button>
</form>
<ul class="food-picker-results" data-barcode-results></ul>
</div>
<div class="food-picker-panel" role="tabpanel" id="${escapeHtml(searchPanel)}" data-panel="search" aria-labelledby="${escapeHtml(id)}-tab-search" hidden>
<label for="${escapeHtml(id)}-search">Search</label>
<input id="${escapeHtml(id)}-search" type="search" data-search-input autocomplete="off" />
<ul class="food-picker-results" data-search-results></ul>
</div>
<div class="food-picker-panel" role="tabpanel" id="${escapeHtml(manualPanel)}" data-panel="manual" aria-labelledby="${escapeHtml(id)}-tab-manual" hidden>
<label for="${escapeHtml(id)}-name">Name</label>
<input id="${escapeHtml(id)}-name" name="food_name" type="text" autocomplete="off" />
${renderQuantityField({ kind: "food", idPrefix: `${id}-manual-qty`, namePrefix: `${id.replace(/-/g, "_")}_qty` })}
</div>
<script type="application/json" data-demo-foods>${catalog}</script>
</div>
${pickerScript(id)}`;
}
