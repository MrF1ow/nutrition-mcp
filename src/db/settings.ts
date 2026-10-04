import {
    grocerySectionFromRow,
    grocerySectionToRow,
    groceryStoreFromRow,
    groceryStoreToRow,
    type SettingsStore,
} from "../settings.js";
import { getSupabase } from "./client.js";

const GROCERY_STORE_COLS = "id, household_id, name, sort_order";
const GROCERY_SECTION_COLS =
    "id, household_id, store_id, name, sort_order, hidden, is_other";

export function liveSettingsStore(): SettingsStore {
    return {
        async getLocation(householdId) {
            const { data, error } = await getSupabase()
                .from("households")
                .select("location")
                .eq("id", householdId)
                .maybeSingle();
            if (error) {
                throw new Error(
                    `Failed to load household location: ${error.message}`,
                );
            }
            return typeof data?.location === "string" && data.location.trim()
                ? data.location
                : null;
        },
        async setLocation(householdId, location) {
            const { error } = await getSupabase()
                .from("households")
                .update({ location })
                .eq("id", householdId);
            if (error) {
                throw new Error(
                    `Failed to save household location: ${error.message}`,
                );
            }
        },
        async listStores(householdId) {
            const { data, error } = await getSupabase()
                .from("grocery_stores")
                .select(GROCERY_STORE_COLS)
                .eq("household_id", householdId)
                .order("sort_order", { ascending: true })
                .order("name", { ascending: true });
            if (error) {
                throw new Error(
                    `Failed to list grocery stores: ${error.message}`,
                );
            }
            return (data ?? []).map(groceryStoreFromRow);
        },
        async insertStore(row) {
            const { data, error } = await getSupabase()
                .from("grocery_stores")
                .insert(groceryStoreToRow(row))
                .select(GROCERY_STORE_COLS)
                .single();
            if (error) {
                throw new Error(
                    `Failed to add grocery store: ${error.message}`,
                );
            }
            return groceryStoreFromRow(data);
        },
        async listSections(storeId) {
            const { data, error } = await getSupabase()
                .from("grocery_sections")
                .select(GROCERY_SECTION_COLS)
                .eq("store_id", storeId)
                .order("sort_order", { ascending: true })
                .order("name", { ascending: true });
            if (error) {
                throw new Error(
                    `Failed to list grocery sections: ${error.message}`,
                );
            }
            return (data ?? []).map(grocerySectionFromRow);
        },
        async getSection(householdId, id) {
            const { data, error } = await getSupabase()
                .from("grocery_sections")
                .select(GROCERY_SECTION_COLS)
                .eq("id", id)
                .eq("household_id", householdId)
                .maybeSingle();
            if (error) {
                throw new Error(
                    `Failed to load grocery section: ${error.message}`,
                );
            }
            return data ? grocerySectionFromRow(data) : null;
        },
        async insertSection(row) {
            const { data, error } = await getSupabase()
                .from("grocery_sections")
                .insert(grocerySectionToRow(row))
                .select(GROCERY_SECTION_COLS)
                .single();
            if (error) {
                throw new Error(
                    `Failed to add grocery section: ${error.message}`,
                );
            }
            return grocerySectionFromRow(data);
        },
        async updateSection(row) {
            const { data, error } = await getSupabase()
                .from("grocery_sections")
                .update(grocerySectionToRow(row))
                .eq("id", row.id)
                .eq("household_id", row.householdId)
                .select(GROCERY_SECTION_COLS)
                .maybeSingle();
            if (error) {
                throw new Error(
                    `Failed to update grocery section: ${error.message}`,
                );
            }
            return data ? grocerySectionFromRow(data) : null;
        },
    };
}

export type { SettingsStore };
