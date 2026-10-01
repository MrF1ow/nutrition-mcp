import { escapeHtml, renderAppShell } from "../shell.js";
import type { ViewerChrome } from "../shell.js";
import type { HouseholdMember } from "../../household.js";
import type { GrocerySection, GroceryStore } from "../../settings.js";
import {
    ALLERGEN_LABELS,
    NAMED_ALLERGENS,
    type MemberAllergen,
    type MemberDislike,
    type PersonRule,
    type StoreRule,
} from "../../rules.js";

export type HouseholdStoreView = GroceryStore & {
    sections: GrocerySection[];
    rules: StoreRule[];
};

export type HouseholdMemberRulesView = {
    member: HouseholdMember;
    rules: PersonRule[];
    allergens: MemberAllergen[];
    dislikes: MemberDislike[];
};

export type HouseholdSettingsView = {
    chrome: ViewerChrome;
    householdName: string;
    location: string;
    members: HouseholdMember[];
    stores: HouseholdStoreView[];
    memberRules: HouseholdMemberRulesView[];
    isOwner: boolean;
    error?: string;
    issuedToken?: string;
};

function addMemberFormHtml(error?: string): string {
    const banner = error
        ? `<p class="error-banner">${escapeHtml(error)}</p>`
        : "";
    return `<form method="POST" action="/settings/household" class="add-member">
            <h2 class="section-title">Add household member</h2>
            ${banner}
            <label for="add_display_name">Name</label>
            <input id="add_display_name" name="display_name" required maxlength="80" />
            <label for="add_password">Password</label>
            <input id="add_password" name="password" type="password" required />
            <label for="add_email">Email</label>
            <input id="add_email" name="email" type="email" />
            <label for="add_username">Username</label>
            <input id="add_username" name="username" autocomplete="username" />
            <button type="submit">Add member</button>
        </form>`;
}

function sectionRow(section: GrocerySection, canEdit: boolean): string {
    if (!canEdit) {
        return `<li class="store-section">${escapeHtml(section.name)}</li>`;
    }
    return `<li class="store-section">
<form class="section-rename" method="post" action="/settings/household/sections/${escapeHtml(section.id)}">
<label class="visually-hidden" for="section-name-${escapeHtml(section.id)}">Section name</label>
<input id="section-name-${escapeHtml(section.id)}" name="name" value="${escapeHtml(section.name)}" required maxlength="80" />
<button type="submit">Rename</button>
</form>
</li>`;
}

function storeCard(store: HouseholdStoreView, canEdit: boolean): string {
    const sections = store.sections
        .map((section) => sectionRow(section, canEdit))
        .join("");
    const rules = store.rules
        .map((rule) => `<li class="store-rule">${escapeHtml(rule.body)}</li>`)
        .join("");
    const ruleForm = canEdit
        ? `<form method="post" action="/settings/household/stores/${escapeHtml(store.id)}/rules" class="store-rule-form">
<label for="store-rule-${escapeHtml(store.id)}">Store rule</label>
<textarea id="store-rule-${escapeHtml(store.id)}" name="body" required maxlength="500"></textarea>
<button type="submit">Save store rule</button>
</form>`
        : "";
    return `<section class="household-store" data-store-id="${escapeHtml(store.id)}">
<h3>${escapeHtml(store.name)}</h3>
<ul class="store-section-list">${sections}</ul>
<ul class="store-rule-list">${rules}</ul>
${ruleForm}
</section>`;
}

function allergenLabel(row: MemberAllergen): string {
    if (row.allergen === "other") return row.otherLabel ?? "Other";
    return ALLERGEN_LABELS[row.allergen];
}

function memberRulesCard(
    view: HouseholdMemberRulesView,
    canEdit: boolean,
): string {
    const allergens = view.allergens
        .map(
            (row) =>
                `<li class="allergen">${escapeHtml(allergenLabel(row))}</li>`,
        )
        .join("");
    const dislikes = view.dislikes
        .map((row) => `<li class="dislike">${escapeHtml(row.displayName)}</li>`)
        .join("");
    const rules = view.rules
        .map((row) => `<li class="person-rule">${escapeHtml(row.body)}</li>`)
        .join("");
    const allergenOptions = NAMED_ALLERGENS.map(
        (code) =>
            `<option value="${code}">${escapeHtml(ALLERGEN_LABELS[code])}</option>`,
    ).join("");
    const forms = canEdit
        ? `<form method="post" action="/settings/household/members/${escapeHtml(view.member.userId)}/allergens" class="allergen-form">
<label for="allergen-${escapeHtml(view.member.userId)}">Allergen</label>
<select id="allergen-${escapeHtml(view.member.userId)}" name="allergen">
${allergenOptions}
<option value="other">Other</option>
</select>
<label for="allergen-other-${escapeHtml(view.member.userId)}">Other allergen</label>
<input id="allergen-other-${escapeHtml(view.member.userId)}" name="other_label" maxlength="80" />
<button type="submit">Save allergen</button>
</form>
<form method="post" action="/settings/household/members/${escapeHtml(view.member.userId)}/dislikes" class="dislike-form">
<label for="dislike-${escapeHtml(view.member.userId)}">Dislike</label>
<input id="dislike-${escapeHtml(view.member.userId)}" name="display_name" required maxlength="80" />
<button type="submit">Save dislike</button>
</form>
<form method="post" action="/settings/household/members/${escapeHtml(view.member.userId)}/rules" class="person-rule-form">
<label for="person-rule-${escapeHtml(view.member.userId)}">Person rule</label>
<textarea id="person-rule-${escapeHtml(view.member.userId)}" name="body" required maxlength="500"></textarea>
<button type="submit">Save person rule</button>
</form>`
        : "";
    return `<section class="member-rules" data-user-id="${escapeHtml(view.member.userId)}">
<h3>${escapeHtml(view.member.displayName)}</h3>
<ul class="allergen-list">${allergens}</ul>
<ul class="dislike-list">${dislikes}</ul>
<ul class="person-rule-list">${rules}</ul>
${forms}
</section>`;
}

export function renderHouseholdSettingsPage(
    view: HouseholdSettingsView,
): string {
    const error = view.error
        ? `<p class="error-banner">${escapeHtml(view.error)}</p>`
        : "";
    const token = view.issuedToken
        ? `<p class="token-once">Household bot token (shown once): <code>${escapeHtml(view.issuedToken)}</code></p>`
        : "";
    const members = view.members
        .map(
            (member) =>
                `<li class="household-member" data-role="${escapeHtml(member.role)}">${escapeHtml(member.displayName)} · ${escapeHtml(member.role)}</li>`,
        )
        .join("");
    const ownerForms = view.isOwner
        ? `${addMemberFormHtml()}
<form method="post" action="/settings/household/rotate-token" class="rotate-token">
<button type="submit">Rotate household token</button>
</form>
<form method="post" action="/settings/household/name" class="household-name">
<label for="household_name">Household name</label>
<input id="household_name" name="name" value="${escapeHtml(view.householdName)}" required maxlength="80" />
<button type="submit">Save name</button>
</form>
<form method="post" action="/settings/household/location" class="household-location">
<label for="household_location">Household location</label>
<input id="household_location" name="location" value="${escapeHtml(view.location)}" maxlength="120" />
<button type="submit">Save location</button>
</form>
<form method="post" action="/settings/household/stores" class="add-store">
<label for="store_name">Grocery store</label>
<input id="store_name" name="name" required maxlength="80" autocomplete="off" />
<button type="submit">Add store</button>
</form>`
        : `<p class="household-name">${escapeHtml(view.householdName)}</p>
<p class="household-location">${view.location ? escapeHtml(view.location) : "No location set."}</p>`;
    const stores = view.stores
        .map((store) => storeCard(store, view.isOwner))
        .join("");
    const memberRules = view.memberRules
        .map((row) => memberRulesCard(row, view.isOwner))
        .join("");
    const body = `
        <h1>Household</h1>
        <p class="settings-lead"><a href="/settings">Account</a></p>
        ${error}
        ${token}
        ${ownerForms}
        <h2>Members</h2>
        <ul class="household-members">${members}</ul>
        <h2>Grocery stores</h2>
        ${stores || `<p class="empty-stores">Add a grocery store.</p>`}
        <h2>Rules</h2>
        ${memberRules}
    `;
    return renderAppShell({
        title: "Household",
        active: "settings",
        theme: view.chrome.theme,
        accent: view.chrome.accent,
        body,
    });
}

export { addMemberFormHtml };
