export function formText(
    body: Record<string, string | File>,
    key: string,
): string {
    const value = body[key];
    return typeof value === "string" ? value : "";
}

export function formAmount(
    body: Record<string, string | File>,
    key: string,
): number {
    return Number(formText(body, key));
}
