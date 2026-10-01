import { ACCENT_SWATCHES, renderAppShell, type ViewerChrome } from "./shell.js";
import { renderAlreadyHaveTag } from "./components/already-have-tag.js";
import { renderFoodPicker } from "./components/food-picker.js";
import {
    DEMO_HOUSEHOLD_MEMBERS,
    renderMemberMultiSelect,
} from "./components/member-multi-select.js";
import { renderQuantityField } from "./components/quantity-field.js";
import { renderStoreSectionList } from "./components/store-section-list.js";

export function renderGroceryStub(chrome?: ViewerChrome): string {
    const view = chrome ?? {
        theme: "light",
        accent: ACCENT_SWATCHES.sky,
    };
    const selfId = DEMO_HOUSEHOLD_MEMBERS[0]!.userId;
    const body = `
        <h1>Groceries</h1>
        <p class="coming-soon">Coming soon.</p>
        <section class="component-demo" aria-label="Shared controls demo">
            <h2>Quantity</h2>
            ${renderQuantityField({ kind: "food", amount: 1360.8, idPrefix: "grocery-qty", namePrefix: "grocery_qty" })}
            <h2>Food</h2>
            ${renderFoodPicker({ id: "grocery-picker" })}
            <h2>For who</h2>
            ${renderMemberMultiSelect(DEMO_HOUSEHOLD_MEMBERS, [selfId])}
            <h2>Already have</h2>
            ${renderAlreadyHaveTag({
                cover: "partial",
                have: { amount: 24, unit: "oz" },
                need: { amount: 24, unit: "oz" },
            })}
            <h2>Store sections</h2>
            ${renderStoreSectionList()}
        </section>
    `;
    return renderAppShell({
        title: "Groceries",
        active: "grocery",
        theme: view.theme,
        accent: view.accent,
        body,
    });
}
