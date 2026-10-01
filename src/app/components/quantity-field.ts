import type { QuantityUnit } from "../../quantity.js";
import { escapeHtml } from "../shell.js";

export type QuantityFieldKind = "food" | "supply";

const FOOD_UNITS: readonly QuantityUnit[] = ["g"];
const SUPPLY_UNITS: readonly QuantityUnit[] = [
    "g",
    "oz",
    "lb",
    "ml",
    "fl oz",
    "cup",
    "each",
];

export type QuantityFieldOptions = {
    kind: QuantityFieldKind;
    amount?: number;
    unit?: QuantityUnit;
    namePrefix?: string;
    idPrefix?: string;
};

export function renderQuantityField(opts: QuantityFieldOptions): string {
    const units = opts.kind === "food" ? FOOD_UNITS : SUPPLY_UNITS;
    const selected = opts.kind === "food" ? "g" : (opts.unit ?? units[0]!);
    const prefix = opts.namePrefix ?? "qty";
    const idPrefix = opts.idPrefix ?? prefix;
    const amountValue =
        opts.amount == null || !Number.isFinite(opts.amount)
            ? ""
            : String(opts.amount);
    const options = units
        .map((unit) => {
            const sel = unit === selected ? " selected" : "";
            return `<option value="${escapeHtml(unit)}"${sel}>${escapeHtml(unit)}</option>`;
        })
        .join("");
    return `<div class="quantity-field" data-kind="${opts.kind}">
<label class="quantity-field-amount" for="${escapeHtml(idPrefix)}-amount">Amount</label>
<input id="${escapeHtml(idPrefix)}-amount" name="${escapeHtml(prefix)}_amount" type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(amountValue)}" />
<label class="quantity-field-unit" for="${escapeHtml(idPrefix)}-unit">Unit</label>
<select id="${escapeHtml(idPrefix)}-unit" name="${escapeHtml(prefix)}_unit">${options}</select>
</div>`;
}
