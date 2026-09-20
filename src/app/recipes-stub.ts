import { comingSoonPage, type ViewerChrome } from "./shell.js";

export function renderRecipesStub(chrome?: ViewerChrome): string {
    return comingSoonPage("recipes", chrome);
}
