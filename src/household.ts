import type { AuthContext } from "./auth-context.js";

export type MemberRole = "owner" | "member";

export type HouseholdMember = {
    householdId: string;
    userId: string;
    role: MemberRole;
    displayName: string;
};

export type Household = {
    id: string;
    name: string;
    fridgeLocations: string[];
    recipeSearchPlaces: unknown[];
    preferences: Record<string, unknown>;
};

export type RequireMemberResult =
    | { ok: true; member: HouseholdMember }
    | { ok: false; error: "not_a_member" };

export class HouseholdAlreadyExistsError extends Error {
    readonly code = "household_already_exists" as const;

    constructor() {
        super("household already exists");
        this.name = "HouseholdAlreadyExistsError";
    }
}

export class DuplicateMembershipError extends Error {
    readonly code = "duplicate_membership" as const;

    constructor() {
        super("membership already exists for this user");
        this.name = "DuplicateMembershipError";
    }
}

export class DuplicateOwnerError extends Error {
    readonly code = "duplicate_owner" as const;

    constructor() {
        super("household already has an owner");
        this.name = "DuplicateOwnerError";
    }
}

export type HouseholdStore = {
    getHousehold(): Household | null;
    insertHousehold(household: Household): void;
    getMember(userId: string): HouseholdMember | null;
    insertMember(member: HouseholdMember): void;
    listMembers(householdId: string): HouseholdMember[];
    deleteUser(userId: string): void;
};

export function createMemoryHouseholdStore(): HouseholdStore {
    const households: Household[] = [];
    const members: HouseholdMember[] = [];

    return {
        getHousehold() {
            return households[0] ?? null;
        },
        insertHousehold(household) {
            if (households.length > 0) {
                throw new HouseholdAlreadyExistsError();
            }
            households.push({
                id: household.id,
                name: household.name,
                fridgeLocations: [...household.fridgeLocations],
                recipeSearchPlaces: [...household.recipeSearchPlaces],
                preferences: { ...household.preferences },
            });
        },
        getMember(userId) {
            return members.find((member) => member.userId === userId) ?? null;
        },
        insertMember(member) {
            if (members.some((existing) => existing.userId === member.userId)) {
                throw new DuplicateMembershipError();
            }
            if (
                member.role === "owner" &&
                members.some((existing) => existing.role === "owner")
            ) {
                throw new DuplicateOwnerError();
            }
            members.push({ ...member });
        },
        listMembers(householdId) {
            return members
                .filter((member) => member.householdId === householdId)
                .map((member) => ({ ...member }));
        },
        deleteUser(userId) {
            const index = members.findIndex(
                (member) => member.userId === userId,
            );
            if (index >= 0) members.splice(index, 1);
        },
    };
}

export function getHouseholdId(
    store: HouseholdStore,
    userId: string,
): string | null {
    return store.getMember(userId)?.householdId ?? null;
}

export function listMembers(
    store: HouseholdStore,
    householdId: string,
): HouseholdMember[] {
    return store.listMembers(householdId);
}

export function requireMember(
    store: HouseholdStore,
    userId: string,
): RequireMemberResult {
    return requireMemberOfHousehold(store.getMember(userId), null);
}

export function requireMemberOfHousehold(
    member: HouseholdMember | null | undefined,
    householdId: string | null,
): RequireMemberResult {
    if (member == null) return { ok: false, error: "not_a_member" };
    if (householdId != null && member.householdId !== householdId) {
        return { ok: false, error: "not_a_member" };
    }
    return { ok: true, member };
}

export type ResolveActorError = "missing_target" | "oauth_mismatch";

export type ResolveActorResult =
    | { ok: true; userId: string; membership: "not_required" }
    | {
          ok: true;
          userId: string;
          membership: "required";
          householdId: string;
      }
    | { ok: false; error: ResolveActorError };

export function resolveActorUserId(
    auth: AuthContext,
    requestedUserId: string | undefined,
): ResolveActorResult {
    if (auth.kind === "user") {
        if (requestedUserId != null && requestedUserId !== auth.userId) {
            return { ok: false, error: "oauth_mismatch" };
        }
        return {
            ok: true,
            userId: auth.userId,
            membership: "not_required",
        };
    }
    if (requestedUserId == null) {
        return { ok: false, error: "missing_target" };
    }
    return {
        ok: true,
        userId: requestedUserId,
        membership: "required",
        householdId: auth.householdId,
    };
}

export function bootstrapHousehold(
    store: HouseholdStore,
    userId: string,
    name: string,
    displayName: string,
): string {
    const existing = store.getMember(userId);
    if (existing != null) return existing.householdId;

    const household = store.getHousehold();
    if (household != null) {
        store.insertMember({
            householdId: household.id,
            userId,
            role: "member",
            displayName,
        });
        return household.id;
    }

    const householdId = crypto.randomUUID();
    store.insertHousehold({
        id: householdId,
        name,
        fridgeLocations: [],
        recipeSearchPlaces: [],
        preferences: {},
    });
    store.insertMember({
        householdId,
        userId,
        role: "owner",
        displayName,
    });
    return householdId;
}
