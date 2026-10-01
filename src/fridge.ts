import type { FoodIdentity, SupplyIdentity } from "./food-identity.js";
import { normalizeBarcode, type FoodResult } from "./foods.js";

export type FridgeKind = "food" | "supply";

export type FridgeQuantity = { amount: number; unit: string };

export type FridgeLocation = {
    id: string;
    householdId: string;
    name: string;
    sortOrder: number;
};

export type FridgeItem = {
    id: string;
    householdId: string;
    locationId: string;
    kind: FridgeKind;
    displayName: string;
    quantity: FridgeQuantity;
    identity: FoodIdentity | SupplyIdentity;
};

export type FridgeSnapshot = {
    locations: FridgeLocation[];
    items: FridgeItem[];
};

export type FridgeStore = {
    listLocations(householdId: string): Promise<FridgeLocation[]>;
    insertLocation(row: FridgeLocation): Promise<FridgeLocation>;
    updateLocation(row: FridgeLocation): Promise<FridgeLocation | null>;
    deleteLocation(householdId: string, id: string): Promise<boolean>;
    listItems(householdId: string): Promise<FridgeItem[]>;
    insertItem(row: FridgeItem): Promise<FridgeItem>;
    updateItem(row: FridgeItem): Promise<FridgeItem | null>;
    deleteItem(householdId: string, id: string): Promise<boolean>;
};

export class FridgeInputError extends Error {
    readonly code = "fridge_input" as const;

    constructor(message: string) {
        super(message);
        this.name = "FridgeInputError";
    }
}

export function createMemoryFridgeStore(): FridgeStore {
    const locations: FridgeLocation[] = [];
    const items: FridgeItem[] = [];

    return {
        async listLocations(householdId) {
            return locations
                .filter((row) => row.householdId === householdId)
                .slice()
                .sort(
                    (a, b) =>
                        a.sortOrder - b.sortOrder ||
                        a.name.localeCompare(b.name),
                );
        },
        async insertLocation(row) {
            locations.push({ ...row });
            return { ...row };
        },
        async updateLocation(row) {
            const idx = locations.findIndex(
                (loc) =>
                    loc.id === row.id && loc.householdId === row.householdId,
            );
            if (idx < 0) return null;
            locations[idx] = { ...row };
            return { ...row };
        },
        async deleteLocation(householdId, id) {
            const before = locations.length;
            for (let i = items.length - 1; i >= 0; i--) {
                if (
                    items[i]!.householdId === householdId &&
                    items[i]!.locationId === id
                ) {
                    items.splice(i, 1);
                }
            }
            const next = locations.filter(
                (loc) => !(loc.householdId === householdId && loc.id === id),
            );
            const removed = next.length < before;
            locations.length = 0;
            locations.push(...next);
            return removed;
        },
        async listItems(householdId) {
            return items
                .filter((row) => row.householdId === householdId)
                .map((row) => ({ ...row, quantity: { ...row.quantity } }));
        },
        async insertItem(row) {
            const saved = {
                ...row,
                quantity: { ...row.quantity },
            };
            items.push(saved);
            return {
                ...saved,
                quantity: { ...saved.quantity },
            };
        },
        async updateItem(row) {
            const idx = items.findIndex(
                (item) =>
                    item.id === row.id && item.householdId === row.householdId,
            );
            if (idx < 0) return null;
            items[idx] = { ...row, quantity: { ...row.quantity } };
            return { ...row, quantity: { ...row.quantity } };
        },
        async deleteItem(householdId, id) {
            const before = items.length;
            const next = items.filter(
                (item) => !(item.householdId === householdId && item.id === id),
            );
            const removed = next.length < before;
            items.length = 0;
            items.push(...next);
            return removed;
        },
    };
}

export async function listFridge(
    store: FridgeStore,
    householdId: string,
): Promise<FridgeSnapshot> {
    const [locations, items] = await Promise.all([
        store.listLocations(householdId),
        store.listItems(householdId),
    ]);
    return { locations, items };
}

export async function addLocation(
    store: FridgeStore,
    householdId: string,
    name: string,
): Promise<FridgeLocation> {
    const trimmed = name.trim();
    if (!trimmed) throw new FridgeInputError("Enter a location name.");
    const existing = await store.listLocations(householdId);
    if (existing.some((loc) => loc.name === trimmed)) {
        throw new FridgeInputError("That location already exists.");
    }
    const sortOrder =
        existing.reduce((max, loc) => Math.max(max, loc.sortOrder), -1) + 1;
    return store.insertLocation({
        id: crypto.randomUUID(),
        householdId,
        name: trimmed,
        sortOrder,
    });
}

export async function deleteLocation(
    store: FridgeStore,
    householdId: string,
    id: string,
): Promise<boolean> {
    return store.deleteLocation(householdId, id);
}

function parseAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new FridgeInputError("Enter an amount greater than zero.");
    }
    return amount;
}

export async function addFoodByBarcode(
    store: FridgeStore,
    input: {
        householdId: string;
        locationId: string;
        barcode: string;
        amount: number;
    },
    opts: {
        lookup: (barcode: string) => Promise<FoodResult | null>;
    },
): Promise<FridgeItem> {
    await requireLocation(store, input.householdId, input.locationId);
    const barcode = normalizeBarcode(input.barcode);
    if (!barcode) throw new FridgeInputError("Enter a valid barcode.");
    const amount = parseAmount(input.amount);
    const food = await opts.lookup(barcode);
    if (food == null) throw new FridgeInputError("Unknown barcode.");
    const identity: FoodIdentity = {
        kind: "food",
        via: "barcode",
        barcode,
        displayName: food.name,
    };
    return store.insertItem({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        locationId: input.locationId,
        kind: "food",
        displayName: food.name,
        quantity: { amount, unit: "g" },
        identity,
    });
}

export async function addManualFood(
    store: FridgeStore,
    input: {
        householdId: string;
        locationId: string;
        name: string;
        amount: number;
    },
): Promise<FridgeItem> {
    await requireLocation(store, input.householdId, input.locationId);
    const name = input.name.trim();
    if (!name) throw new FridgeInputError("Enter a food name.");
    const amount = parseAmount(input.amount);
    const identity: FoodIdentity = {
        kind: "food",
        via: "manual",
        householdManualId: crypto.randomUUID(),
        displayName: name,
    };
    return store.insertItem({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        locationId: input.locationId,
        kind: "food",
        displayName: name,
        quantity: { amount, unit: "g" },
        identity,
    });
}

export async function addSupply(
    store: FridgeStore,
    input: {
        householdId: string;
        locationId: string;
        name: string;
        amount: number;
        unit: string;
    },
): Promise<FridgeItem> {
    await requireLocation(store, input.householdId, input.locationId);
    const name = input.name.trim();
    if (!name) throw new FridgeInputError("Enter a supply name.");
    const unit = input.unit.trim();
    if (!unit) throw new FridgeInputError("Enter a unit.");
    const amount = parseAmount(input.amount);
    const identity: SupplyIdentity = {
        kind: "supply",
        via: "manual",
        householdManualId: crypto.randomUUID(),
        displayName: name,
    };
    return store.insertItem({
        id: crypto.randomUUID(),
        householdId: input.householdId,
        locationId: input.locationId,
        kind: "supply",
        displayName: name,
        quantity: { amount, unit },
        identity,
    });
}

export async function updateItemQuantity(
    store: FridgeStore,
    householdId: string,
    itemId: string,
    quantity: FridgeQuantity,
): Promise<FridgeItem | null> {
    const items = await store.listItems(householdId);
    const current = items.find((item) => item.id === itemId);
    if (!current) return null;
    const amount = parseAmount(quantity.amount);
    const unit = current.kind === "food" ? "g" : quantity.unit.trim();
    if (current.kind === "supply" && !unit) {
        throw new FridgeInputError("Enter a unit.");
    }
    return store.updateItem({
        ...current,
        quantity: { amount, unit },
    });
}

export async function moveItem(
    store: FridgeStore,
    householdId: string,
    itemId: string,
    locationId: string,
): Promise<FridgeItem | null> {
    await requireLocation(store, householdId, locationId);
    const items = await store.listItems(householdId);
    const current = items.find((item) => item.id === itemId);
    if (!current) return null;
    return store.updateItem({ ...current, locationId });
}

export async function deleteItem(
    store: FridgeStore,
    householdId: string,
    itemId: string,
): Promise<boolean> {
    return store.deleteItem(householdId, itemId);
}

async function requireLocation(
    store: FridgeStore,
    householdId: string,
    locationId: string,
): Promise<FridgeLocation> {
    const locations = await store.listLocations(householdId);
    const loc = locations.find((row) => row.id === locationId);
    if (!loc) throw new FridgeInputError("Unknown location.");
    return loc;
}

export function fridgeLocationFromRow(row: {
    id: unknown;
    household_id: unknown;
    name: unknown;
    sort_order: unknown;
}): FridgeLocation {
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        name: String(row.name),
        sortOrder: Number(row.sort_order) || 0,
    };
}

export function fridgeItemFromRow(row: {
    id: unknown;
    household_id: unknown;
    location_id: unknown;
    kind: unknown;
    display_name: unknown;
    amount: unknown;
    unit: unknown;
    identity: unknown;
}): FridgeItem {
    const kind = row.kind === "supply" ? "supply" : "food";
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        locationId: String(row.location_id),
        kind,
        displayName: String(row.display_name),
        quantity: {
            amount: Number(row.amount),
            unit: String(row.unit),
        },
        identity: row.identity as FoodIdentity | SupplyIdentity,
    };
}

export function fridgeLocationToRow(row: FridgeLocation) {
    return {
        id: row.id,
        household_id: row.householdId,
        name: row.name,
        sort_order: row.sortOrder,
    };
}

export function fridgeItemToRow(row: FridgeItem) {
    return {
        id: row.id,
        household_id: row.householdId,
        location_id: row.locationId,
        kind: row.kind,
        display_name: row.displayName,
        amount: row.quantity.amount,
        unit: row.quantity.unit,
        identity: row.identity,
    };
}
