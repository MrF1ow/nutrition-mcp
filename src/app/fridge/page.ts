import { formatQuantity } from "../../quantity.js";
import type {
    FridgeItem,
    FridgeLocation,
    FridgeSnapshot,
} from "../../fridge.js";
import { escapeHtml, renderAppShell, type ViewerChrome } from "../shell.js";
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

export type FridgePageView = FridgeSnapshot & {
    chrome: ViewerChrome;
    error?: string;
};

function quantityLabel(item: FridgeItem): string {
    if (item.kind === "food") {
        return formatQuantity({ amount: item.quantity.amount, unit: "g" });
    }
    return `${item.quantity.amount} ${item.quantity.unit}`;
}

function locationSelect(
    locations: FridgeLocation[],
    selectedId: string,
    name: string,
    id: string,
): string {
    const options = locations
        .map((loc) => {
            const sel = loc.id === selectedId ? " selected" : "";
            return `<option value="${escapeHtml(loc.id)}"${sel}>${escapeHtml(loc.name)}</option>`;
        })
        .join("");
    return `<select id="${escapeHtml(id)}" name="${escapeHtml(name)}">${options}</select>`;
}

function itemRow(item: FridgeItem, locations: FridgeLocation[]): string {
    const qtyId = `qty-${item.id}`;
    const qty =
        item.kind === "food"
            ? renderQuantityField({
                  kind: "food",
                  amount: item.quantity.amount,
                  idPrefix: qtyId,
                  namePrefix: "qty",
                  required: true,
              })
            : renderQuantityField({
                  kind: "supply",
                  amount: item.quantity.amount,
                  unit: item.quantity.unit,
                  units: SUPPLY_UNITS,
                  idPrefix: qtyId,
                  namePrefix: "qty",
                  required: true,
              });
    return `<li class="fridge-item" data-item-id="${escapeHtml(item.id)}" data-kind="${item.kind}">
<div class="fridge-item-head">
<p class="fridge-item-name">${escapeHtml(item.displayName)}</p>
<p class="fridge-item-qty">${escapeHtml(quantityLabel(item))}</p>
</div>
<form class="fridge-item-edit" method="post" action="/fridge/items/${escapeHtml(item.id)}">
${qty}
<label for="move-${escapeHtml(item.id)}">Location</label>
${locationSelect(locations, item.locationId, "location_id", `move-${item.id}`)}
<button type="submit">Save</button>
</form>
<form class="fridge-item-delete" method="post" action="/fridge/items/${escapeHtml(item.id)}/delete">
<button type="submit">Delete</button>
</form>
</li>`;
}

function locationSection(
    location: FridgeLocation,
    items: FridgeItem[],
    locations: FridgeLocation[],
): string {
    const rows = items
        .filter((item) => item.locationId === location.id)
        .map((item) => itemRow(item, locations))
        .join("");
    const empty = items.some((item) => item.locationId === location.id)
        ? ""
        : `<p class="add-item-prompt">Add an item to ${escapeHtml(location.name)}.</p>`;
    const pickerId = `picker-${location.id}`;
    return `<section class="fridge-location" data-location-id="${escapeHtml(location.id)}">
<div class="fridge-location-head">
<h2>${escapeHtml(location.name)}</h2>
<form method="post" action="/fridge/locations/${escapeHtml(location.id)}/delete">
<button type="submit">Remove</button>
</form>
</div>
${empty}
<ul class="fridge-items">${rows}</ul>
<h3>Add food</h3>
${renderFoodPicker({
    id: pickerId,
    action: "/fridge/items",
    method: "post",
    hiddenFields: { kind: "food", location_id: location.id },
    includeQuantity: true,
})}
<h3>Add supply</h3>
<form class="fridge-add-supply" method="post" action="/fridge/items">
<input type="hidden" name="kind" value="supply" />
<input type="hidden" name="location_id" value="${escapeHtml(location.id)}" />
<label for="supply-name-${escapeHtml(location.id)}">Name</label>
<input id="supply-name-${escapeHtml(location.id)}" name="name" type="text" required autocomplete="off" />
${renderQuantityField({
    kind: "supply",
    unit: "roll",
    units: SUPPLY_UNITS,
    idPrefix: `supply-qty-${location.id}`,
    namePrefix: "qty",
    required: true,
})}
<button type="submit">Add supply</button>
</form>
</section>`;
}

export function renderFridgePage(view: FridgePageView): string {
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const emptyPrompt =
        view.locations.length === 0
            ? `<p class="empty-fridge">Add a location, then add an item.</p>`
            : "";
    const sections = view.locations
        .map((loc) => locationSection(loc, view.items, view.locations))
        .join("");
    const body = `
        <h1>Fridge</h1>
        ${error}
        ${emptyPrompt}
        <form class="fridge-add-location" method="post" action="/fridge/locations">
            <label for="location_name">Location name</label>
            <input id="location_name" name="name" type="text" required maxlength="80" autocomplete="off" />
            <button type="submit">Add location</button>
        </form>
        ${sections}
    `;
    return renderAppShell({
        title: "Fridge",
        active: "fridge",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}
