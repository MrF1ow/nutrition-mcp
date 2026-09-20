import type { FoodIdentity, SupplyIdentity } from "./food-identity.js";
import { normalizeBarcode, type FoodResult } from "./foods.js";
import type {
    GrocerySection,
    GroceryStore,
    SettingsStore,
} from "./settings.js";
import {
    ALLERGEN_LABELS,
    type AllergenCode,
    type MemberAllergen,
} from "./rules.js";

export type GroceryKind = "food" | "supply";

export type GroceryQuantity = { amount: number; unit: string };

export type GroceryLine = {
    id: string;
    householdId: string;
    storeId: string;
    sectionId: string;
    kind: GroceryKind;
    displayName: string;
    quantity: GroceryQuantity;
    identity: FoodIdentity | SupplyIdentity;
    checked: boolean;
};

export type GrocerySnapshot = {
    stores: GroceryStore[];
    sections: GrocerySection[];
    lines: GroceryLine[];
};

export type GroceryListStore = {
    listLines(householdId: string): Promise<GroceryLine[]>;
    insertLine(row: GroceryLine): Promise<GroceryLine>;
    updateLine(row: GroceryLine): Promise<GroceryLine | null>;
    deleteLine(householdId: string, id: string): Promise<boolean>;
};

export type GroceryAllergenMember = {
    displayName: string;
    allergens: MemberAllergen[];
};

export type GroceryAllergenWarning = {
    blocking: boolean;
    text: string;
};

export class GroceryInputError extends Error {
    readonly code = "grocery_input" as const;

    constructor(message: string) {
        super(message);
        this.name = "GroceryInputError";
    }
}

export function createMemoryGroceryStore(): GroceryListStore {
    const lines: GroceryLine[] = [];
    return {
        async listLines(householdId) {
            return lines
                .filter((row) => row.householdId === householdId)
                .map((row) => ({
                    ...row,
                    quantity: { ...row.quantity },
                }));
        },
        async insertLine(row) {
            const saved = { ...row, quantity: { ...row.quantity } };
            lines.push(saved);
            return { ...saved, quantity: { ...saved.quantity } };
        },
        async updateLine(row) {
            const idx = lines.findIndex(
                (line) =>
                    line.id === row.id && line.householdId === row.householdId,
            );
            if (idx < 0) return null;
            lines[idx] = { ...row, quantity: { ...row.quantity } };
            return { ...row, quantity: { ...row.quantity } };
        },
        async deleteLine(householdId, id) {
            const before = lines.length;
            const next = lines.filter(
                (line) => !(line.householdId === householdId && line.id === id),
            );
            const removed = next.length < before;
            lines.length = 0;
            lines.push(...next);
            return removed;
        },
    };
}

function parseAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new GroceryInputError("Enter an amount greater than zero.");
    }
    return amount;
}

export async function resolveGrocerySectionId(
    settings: SettingsStore,
    storeId: string,
    sectionId?: string,
): Promise<string> {
    const sections = await settings.listSections(storeId);
    if (sectionId) {
        const match = sections.find((row) => row.id === sectionId);
        if (match) return match.id;
    }
    const other = sections.find((row) => row.isOther);
    if (!other) throw new GroceryInputError("Unknown section.");
    return other.id;
}

async function requireStore(
    settings: SettingsStore,
    householdId: string,
    storeId: string,
): Promise<GroceryStore> {
    const stores = await settings.listStores(householdId);
    const store = stores.find((row) => row.id === storeId);
    if (!store) throw new GroceryInputError("Unknown store.");
    return store;
}

export async function listGrocery(
    grocery: GroceryListStore,
    settings: SettingsStore,
    householdId: string,
): Promise<GrocerySnapshot> {
    const stores = await settings.listStores(householdId);
    const sections = (
        await Promise.all(
            stores.map((store) => settings.listSections(store.id)),
        )
    ).flat();
    const lines = await grocery.listLines(householdId);
    return { stores, sections, lines };
}

export async function addGroceryFoodByBarcode(
    grocery: GroceryListStore,
    settings: SettingsStore,
    input: {
        householdId: string;
        storeId: string;
        sectionId?: string;
        barcode: string;
        amount: number;
    },
    opts: {
        lookup: (barcode: string) => Promise<FoodResult | null>;
    },
): Promise<GroceryLine> {
    await requireStore(settings, input.householdId, input.storeId);
    const sectionId = await resolveGrocerySectionId(
        settings,
        input.storeId,
        input.sectionId,
    );
    const barcode = normalizeBarcode(input.barcode);
    if (!barcode) throw new GroceryInputError("Enter a valid barcode.");
    const amount = parseAmount(input.amount);
    const food = await opts.lookup(barcode);
    if (food == null) throw new GroceryInputError("Unknown barcode.");
    const identity: FoodIdentity = {
        kind: "food",
        via: "barcode",
        barcode,
        displayName: food.name,
    };
    return grocery.insertLine({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        storeId: input.storeId,
        sectionId,
        kind: "food",
        displayName: food.name,
        quantity: { amount, unit: "g" },
        identity,
        checked: false,
    });
}

export async function addGroceryManualFood(
    grocery: GroceryListStore,
    settings: SettingsStore,
    input: {
        householdId: string;
        storeId: string;
        sectionId?: string;
        name: string;
        amount: number;
    },
): Promise<GroceryLine> {
    await requireStore(settings, input.householdId, input.storeId);
    const sectionId = await resolveGrocerySectionId(
        settings,
        input.storeId,
        input.sectionId,
    );
    const name = input.name.trim();
    if (!name) throw new GroceryInputError("Enter a food name.");
    const amount = parseAmount(input.amount);
    const identity: FoodIdentity = {
        kind: "food",
        via: "manual",
        householdManualId: crypto.randomUUID(),
        displayName: name,
    };
    return grocery.insertLine({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        storeId: input.storeId,
        sectionId,
        kind: "food",
        displayName: name,
        quantity: { amount, unit: "g" },
        identity,
        checked: false,
    });
}

export async function addGrocerySupply(
    grocery: GroceryListStore,
    settings: SettingsStore,
    input: {
        householdId: string;
        storeId: string;
        sectionId?: string;
        name: string;
        amount: number;
        unit: string;
    },
): Promise<GroceryLine> {
    await requireStore(settings, input.householdId, input.storeId);
    const sectionId = await resolveGrocerySectionId(
        settings,
        input.storeId,
        input.sectionId,
    );
    const name = input.name.trim();
    if (!name) throw new GroceryInputError("Enter a supply name.");
    const unit = input.unit.trim();
    if (!unit) throw new GroceryInputError("Enter a unit.");
    const amount = parseAmount(input.amount);
    const identity: SupplyIdentity = {
        kind: "supply",
        via: "manual",
        householdManualId: crypto.randomUUID(),
        displayName: name,
    };
    return grocery.insertLine({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        storeId: input.storeId,
        sectionId,
        kind: "supply",
        displayName: name,
        quantity: { amount, unit },
        identity,
        checked: false,
    });
}

export async function checkGroceryLine(
    grocery: GroceryListStore,
    householdId: string,
    lineId: string,
    checked: boolean,
): Promise<GroceryLine | null> {
    const lines = await grocery.listLines(householdId);
    const current = lines.find((line) => line.id === lineId);
    if (!current) return null;
    return grocery.updateLine({ ...current, checked });
}

export async function clearCheckedLines(
    grocery: GroceryListStore,
    householdId: string,
): Promise<number> {
    const lines = await grocery.listLines(householdId);
    let removed = 0;
    for (const line of lines) {
        if (!line.checked) continue;
        if (await grocery.deleteLine(householdId, line.id)) removed += 1;
    }
    return removed;
}

function allergenNeedle(
    code: AllergenCode,
    otherLabel: string | null,
): string[] {
    if (code === "other") {
        return otherLabel ? [otherLabel.toLowerCase()] : [];
    }
    return [code.replaceAll("_", " "), ALLERGEN_LABELS[code].toLowerCase()];
}

export function groceryAllergenWarning(
    displayName: string,
    members: GroceryAllergenMember[],
): GroceryAllergenWarning | null {
    const haystack = displayName.toLowerCase();
    const hitNames: string[] = [];
    const hitCodes = new Set<string>();
    for (const member of members) {
        const matched = member.allergens.some((row) =>
            allergenNeedle(row.allergen, row.otherLabel).some((needle) =>
                needle ? haystack.includes(needle) : false,
            ),
        );
        if (!matched) continue;
        hitNames.push(member.displayName);
        for (const row of member.allergens) {
            for (const needle of allergenNeedle(row.allergen, row.otherLabel)) {
                if (needle && haystack.includes(needle)) hitCodes.add(needle);
            }
        }
    }
    if (hitNames.length === 0) {
        const anyAllergen = members.some((row) => row.allergens.length > 0);
        if (!anyAllergen) return null;
        return { blocking: false, text: "unknown allergen data" };
    }
    const label = [...hitCodes][0] ?? "allergen";
    return {
        blocking: true,
        text: `Contains ${label} — ${hitNames.join(", ")}.`,
    };
}

export function groceryLineFromRow(row: {
    id: unknown;
    household_id: unknown;
    store_id: unknown;
    section_id: unknown;
    kind: unknown;
    display_name: unknown;
    amount: unknown;
    unit: unknown;
    identity: unknown;
    checked: unknown;
}): GroceryLine {
    const kind = row.kind === "supply" ? "supply" : "food";
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        storeId: String(row.store_id),
        sectionId: String(row.section_id),
        kind,
        displayName: String(row.display_name),
        quantity: {
            amount: Number(row.amount),
            unit: String(row.unit),
        },
        identity: row.identity as FoodIdentity | SupplyIdentity,
        checked: Boolean(row.checked),
    };
}

export function groceryLineToRow(row: GroceryLine) {
    return {
        id: row.id,
        household_id: row.householdId,
        store_id: row.storeId,
        section_id: row.sectionId,
        kind: row.kind,
        display_name: row.displayName,
        amount: row.quantity.amount,
        unit: row.quantity.unit,
        identity: row.identity,
        checked: row.checked,
    };
}
