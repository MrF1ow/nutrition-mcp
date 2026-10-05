import type { Context, Next } from "hono";
import { beginSiteLogin } from "../oauth.js";
import {
    requireOwner as ownerCheck,
    type HouseholdMember,
} from "../household.js";
import { getHouseholdMembership } from "../supabase.js";
import { readSiteSession, SITE_COOKIE } from "../site-session.js";
import { forbiddenDashboardHtml } from "./dashboard.js";

declare module "hono" {
    interface ContextVariableMap {
        userId: string;
        member: HouseholdMember | null;
    }
}

export function siteUserId(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${SITE_COOKIE}=([^;]+)`),
    );
    if (!match?.[1]) return null;
    return readSiteSession(decodeURIComponent(match[1]));
}

export function siteMember(c: Context): HouseholdMember {
    const member = c.get("member");
    if (member == null) {
        throw new Error("web: requireMember/requireOwner must run first");
    }
    return member;
}

export const requireSiteUser = async (c: Context, next: Next) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    c.set("userId", userId);
    return next();
};

export const requireMember = async (c: Context, next: Next) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const member = await getHouseholdMembership(userId);
    if (member == null) return c.html(forbiddenDashboardHtml(), 403);
    c.set("userId", userId);
    c.set("member", member);
    return next();
};

export const requireOwner = async (c: Context, next: Next) => {
    const userId = siteUserId(c.req.header("cookie"));
    if (!userId) return beginSiteLogin(c, c.req.query("locale"));
    const member = await getHouseholdMembership(userId);
    const check = ownerCheck(member);
    if (!check.ok) return c.html(forbiddenDashboardHtml(), 403);
    c.set("userId", userId);
    c.set("member", check.member);
    return next();
};
