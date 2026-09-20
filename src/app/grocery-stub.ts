import { comingSoonPage, type ViewerChrome } from "./shell.js";

export function renderGroceryStub(chrome?: ViewerChrome): string {
    return comingSoonPage("grocery", chrome);
}
