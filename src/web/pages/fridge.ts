import { formatQuantity, isQuantityUnit } from "../../domain/quantity.js";
import type {
    FridgeItem,
    FridgeLocation,
    FridgeSnapshot,
} from "../../domain/fridge.js";
import {
    escapeHtml,
    renderAppShell,
    type ViewerChrome,
} from "../../app/shell.js";
import { renderFoodPicker } from "../components/food-picker.js";
import { renderQuantityField } from "../components/quantity-field.js";
import {
    renderAddItemPrompt,
    renderEmptyFridge,
    renderErrorBanner,
    renderFridgeItemRow,
} from "../components/page-markup.js";

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
    if (isQuantityUnit(item.quantity.unit)) {
        return formatQuantity({
            amount: item.quantity.amount,
            unit: item.quantity.unit,
        });
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
                  unit: item.quantity.unit,
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
    return renderFridgeItemRow({
        id: item.id,
        kind: item.kind,
        displayName: item.displayName,
        quantityLabel: quantityLabel(item),
        editFields: `${qty}
<label for="move-${escapeHtml(item.id)}">Location</label>
${locationSelect(locations, item.locationId, "location_id", `move-${item.id}`)}`,
    });
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
        : renderAddItemPrompt(location.name);
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
    const error = renderErrorBanner(view.error);
    const emptyPrompt = view.locations.length === 0 ? renderEmptyFridge() : "";
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
