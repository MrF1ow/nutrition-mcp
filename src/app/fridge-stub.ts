import { comingSoonPage, type ViewerChrome } from "./shell.js";

export function renderFridgeStub(chrome?: ViewerChrome): string {
    return comingSoonPage("fridge", chrome);
}
