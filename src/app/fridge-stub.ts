import { ACCENT_SWATCHES, renderAppShell, type ViewerChrome } from "./shell.js";
import { renderFoodPicker } from "./components/food-picker.js";
import { renderQuantityField } from "./components/quantity-field.js";

export function renderFridgeStub(chrome?: ViewerChrome): string {
    const view = chrome ?? {
        theme: "light",
        accent: ACCENT_SWATCHES.sky,
    };
    const body = `
        <h1>Fridge</h1>
        <p class="coming-soon">Coming soon.</p>
        <section class="component-demo" aria-label="Shared controls demo">
            <h2>Quantity</h2>
            ${renderQuantityField({ kind: "food", amount: 1360.8, idPrefix: "fridge-qty", namePrefix: "fridge_qty" })}
            <h2>Food</h2>
            ${renderFoodPicker({ id: "fridge-picker" })}
        </section>
    `;
    return renderAppShell({
        title: "Fridge",
        active: "fridge",
        theme: view.theme,
        accent: view.accent,
        body,
    });
}
