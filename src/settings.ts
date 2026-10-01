export const DEFAULT_STORE_SECTIONS = [
    "Produce",
    "Dairy",
    "Meat & seafood",
    "Bakery",
    "Frozen",
    "Pantry",
    "Beverages",
    "Household",
    "Other",
] as const;

export type GroceryStore = {
    id: string;
    householdId: string;
    name: string;
    sortOrder: number;
};

export type GrocerySection = {
    id: string;
    householdId: string;
    storeId: string;
    name: string;
    sortOrder: number;
    hidden: boolean;
    isOther: boolean;
};

export type SettingsStore = {
    getLocation(householdId: string): Promise<string | null>;
    setLocation(householdId: string, location: string | null): Promise<void>;
    listStores(householdId: string): Promise<GroceryStore[]>;
    insertStore(row: GroceryStore): Promise<GroceryStore>;
    listSections(storeId: string): Promise<GrocerySection[]>;
    getSection(householdId: string, id: string): Promise<GrocerySection | null>;
    insertSection(row: GrocerySection): Promise<GrocerySection>;
    updateSection(row: GrocerySection): Promise<GrocerySection | null>;
};

export class SettingsInputError extends Error {
    readonly code = "settings_input" as const;

    constructor(message: string) {
        super(message);
        this.name = "SettingsInputError";
    }
}

export function createMemorySettingsStore(): SettingsStore {
    const locations = new Map<string, string | null>();
    const stores: GroceryStore[] = [];
    const sections: GrocerySection[] = [];

    return {
        async getLocation(householdId) {
            return locations.has(householdId)
                ? (locations.get(householdId) ?? null)
                : null;
        },
        async setLocation(householdId, location) {
            locations.set(householdId, location);
        },
        async listStores(householdId) {
            return stores
                .filter((row) => row.householdId === householdId)
                .slice()
                .sort(
                    (a, b) =>
                        a.sortOrder - b.sortOrder ||
                        a.name.localeCompare(b.name),
                )
                .map((row) => ({ ...row }));
        },
        async insertStore(row) {
            stores.push({ ...row });
            return { ...row };
        },
        async listSections(storeId) {
            return sections
                .filter((row) => row.storeId === storeId)
                .slice()
                .sort(
                    (a, b) =>
                        a.sortOrder - b.sortOrder ||
                        a.name.localeCompare(b.name),
                )
                .map((row) => ({ ...row }));
        },
        async getSection(householdId, id) {
            const row = sections.find(
                (section) =>
                    section.id === id && section.householdId === householdId,
            );
            return row ? { ...row } : null;
        },
        async insertSection(row) {
            sections.push({ ...row });
            return { ...row };
        },
        async updateSection(row) {
            const idx = sections.findIndex(
                (section) =>
                    section.id === row.id &&
                    section.householdId === row.householdId,
            );
            if (idx < 0) return null;
            sections[idx] = { ...row };
            return { ...row };
        },
    };
}

export async function createGroceryStore(
    store: SettingsStore,
    householdId: string,
    name: string,
): Promise<GroceryStore> {
    const trimmed = name.trim();
    if (!trimmed) throw new SettingsInputError("Enter a store name.");
    const existing = await store.listStores(householdId);
    if (existing.some((row) => row.name === trimmed)) {
        throw new SettingsInputError("That store already exists.");
    }
    const sortOrder =
        existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const groceryStore = await store.insertStore({
        id: crypto.randomUUID(),
        householdId,
        name: trimmed,
        sortOrder,
    });
    for (const [index, sectionName] of DEFAULT_STORE_SECTIONS.entries()) {
        await store.insertSection({
            id: crypto.randomUUID(),
            householdId,
            storeId: groceryStore.id,
            name: sectionName,
            sortOrder: index,
            hidden: false,
            isOther: sectionName === "Other",
        });
    }
    return groceryStore;
}

export async function renameSection(
    store: SettingsStore,
    householdId: string,
    sectionId: string,
    name: string,
): Promise<GrocerySection> {
    const trimmed = name.trim();
    if (!trimmed) throw new SettingsInputError("Enter a section name.");
    const current = await store.getSection(householdId, sectionId);
    if (current == null) throw new SettingsInputError("Unknown section.");
    const siblings = await store.listSections(current.storeId);
    if (siblings.some((row) => row.id !== sectionId && row.name === trimmed)) {
        throw new SettingsInputError("That section already exists.");
    }
    const updated = await store.updateSection({ ...current, name: trimmed });
    if (updated == null) throw new SettingsInputError("Unknown section.");
    return updated;
}

export async function setHouseholdLocation(
    store: SettingsStore,
    householdId: string,
    location: string,
): Promise<string | null> {
    const trimmed = location.trim();
    const value = trimmed ? trimmed : null;
    await store.setLocation(householdId, value);
    return value;
}

export function groceryStoreFromRow(row: {
    id: unknown;
    household_id: unknown;
    name: unknown;
    sort_order: unknown;
}): GroceryStore {
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        name: String(row.name),
        sortOrder: Number(row.sort_order) || 0,
    };
}

export function grocerySectionFromRow(row: {
    id: unknown;
    household_id: unknown;
    store_id: unknown;
    name: unknown;
    sort_order: unknown;
    hidden: unknown;
    is_other: unknown;
}): GrocerySection {
    return {
        id: String(row.id),
        householdId: String(row.household_id),
        storeId: String(row.store_id),
        name: String(row.name),
        sortOrder: Number(row.sort_order) || 0,
        hidden: row.hidden === true,
        isOther: row.is_other === true,
    };
}

export function groceryStoreToRow(row: GroceryStore) {
    return {
        id: row.id,
        household_id: row.householdId,
        name: row.name,
        sort_order: row.sortOrder,
    };
}

export function grocerySectionToRow(row: GrocerySection) {
    return {
        id: row.id,
        household_id: row.householdId,
        store_id: row.storeId,
        name: row.name,
        sort_order: row.sortOrder,
        hidden: row.hidden,
        is_other: row.isOther,
    };
}
