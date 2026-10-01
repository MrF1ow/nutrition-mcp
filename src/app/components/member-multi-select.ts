import { escapeHtml } from "../shell.js";

export type SelectableMember = {
    userId: string;
    displayName: string;
};

export const DEMO_HOUSEHOLD_MEMBERS: readonly SelectableMember[] = [
    {
        userId: "11111111-1111-4111-8111-111111111111",
        displayName: "Alice",
    },
    {
        userId: "22222222-2222-4222-8222-222222222222",
        displayName: "Bob",
    },
];

export function renderMemberMultiSelect(
    members: readonly SelectableMember[],
    selectedIds: readonly string[] = [],
): string {
    const selected = new Set(selectedIds);
    const labels = members
        .map((member) => {
            const checked = selected.has(member.userId) ? " checked" : "";
            return `<label class="member-choice"><input type="checkbox" name="member_ids" value="${escapeHtml(member.userId)}"${checked} /> ${escapeHtml(member.displayName)}</label>`;
        })
        .join("");
    return `<fieldset class="member-multi-select"><legend>For who</legend>${labels}</fieldset>`;
}
