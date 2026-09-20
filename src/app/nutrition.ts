import { ACCENT_SWATCHES, renderAppShell, type Theme } from "./shell.js";

export function renderNutritionPage(opts: {
    heading: string;
    body: string;
    theme?: Theme;
}): string {
    return renderAppShell({
        title: "Nutrition",
        active: "nutrition",
        theme: opts.theme ?? "light",
        accent: ACCENT_SWATCHES.sky,
        body: `<h1>${opts.heading}</h1>${opts.body}`,
    });
}
