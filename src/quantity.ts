import {
    GRAMS_PER_LB,
    GRAMS_PER_OZ,
    ML_PER_CUP,
    ML_PER_FL_OZ,
} from "./units.js";

export type CanonicalDimension = "mass" | "volume" | "count";

export type MassUnit = "g" | "oz" | "lb";
export type VolumeUnit = "ml" | "fl oz" | "cup";
export type CountUnit = "each";
export type QuantityUnit = MassUnit | VolumeUnit | CountUnit;

export type MassQuantity = { amount: number; unit: MassUnit };
export type VolumeQuantity = { amount: number; unit: VolumeUnit };
export type CountQuantity = {
    amount: number;
    unit: CountUnit;
    gramsPerEach?: number;
};
export type Quantity = MassQuantity | VolumeQuantity | CountQuantity;

const MASS_UNITS = new Set<string>(["g", "oz", "lb"]);
const VOLUME_UNITS = new Set<string>(["ml", "fl oz", "cup"]);
const COUNT_UNITS = new Set<string>(["each"]);

const TO_CANONICAL: Record<QuantityUnit, number> = {
    g: 1,
    oz: GRAMS_PER_OZ,
    lb: GRAMS_PER_LB,
    ml: 1,
    "fl oz": ML_PER_FL_OZ,
    cup: ML_PER_CUP,
    each: 1,
};

export function dimensionOf(unit: QuantityUnit): CanonicalDimension {
    if (MASS_UNITS.has(unit)) return "mass";
    if (VOLUME_UNITS.has(unit)) return "volume";
    if (COUNT_UNITS.has(unit)) return "count";
    throw new Error(`Unknown quantity unit: ${unit}`);
}

export function isQuantityUnit(x: unknown): x is QuantityUnit {
    return typeof x === "string" && x in TO_CANONICAL;
}

export function parseQuantity(raw: string): Quantity {
    const trimmed = raw.trim();
    const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*(.+)$/);
    if (!match) {
        throw new Error(`Invalid quantity: ${raw}`);
    }
    const amountRaw = match[1];
    const unitRaw = match[2];
    if (amountRaw === undefined || unitRaw === undefined) {
        throw new Error(`Invalid quantity: ${raw}`);
    }
    const amount = Number(amountRaw);
    const unit = unitRaw.trim();
    if (!Number.isFinite(amount)) {
        throw new Error(`Invalid quantity amount: ${raw}`);
    }
    if (!isQuantityUnit(unit)) {
        throw new Error(`Unknown quantity unit: ${unit}`);
    }
    const dim = dimensionOf(unit);
    if (dim === "mass") return { amount, unit: unit as MassUnit };
    if (dim === "volume") return { amount, unit: unit as VolumeUnit };
    return { amount, unit: "each" };
}

export function formatQuantity(q: Quantity): string {
    return `${q.amount} ${q.unit}`;
}

function roundAmount(amount: number): number {
    return Math.round(amount * 10) / 10;
}

export function convertQuantity(q: Quantity, to: QuantityUnit): Quantity {
    if (!Number.isFinite(q.amount)) {
        throw new Error(`Invalid quantity amount: ${q.amount}`);
    }
    const fromDim = dimensionOf(q.unit);
    const toDim = dimensionOf(to);
    if (fromDim !== toDim) {
        throw new Error(
            `Cannot convert ${q.unit} (${fromDim}) to ${to} (${toDim})`,
        );
    }
    if (q.unit === "each" && to === "each") {
        return { amount: q.amount, unit: "each", gramsPerEach: q.gramsPerEach };
    }
    const canonical = q.amount * TO_CANONICAL[q.unit];
    const amount = roundAmount(canonical / TO_CANONICAL[to]);
    if (toDim === "mass") return { amount, unit: to as MassUnit };
    return { amount, unit: to as VolumeUnit };
}
