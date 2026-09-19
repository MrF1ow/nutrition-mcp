#!/usr/bin/env bun
/**
 * depersonalize.ts — strip the maintainer's personal bits so a fork is
 * clean to self-host.
 *
 *   bun run scripts/depersonalize.ts          # rewrite files in place
 *   bun run scripts/depersonalize.ts --dry    # report only, change nothing
 *
 * Targets the login templates (`public/login.html` and
 * `public/{locale}/login.html`), remaining personal bits in HEAD_ASSETS
 * (GA), the Glama route in src/index.ts, the import-widget support email,
 * and robots.txt. Must not assume marketing pages exist.
 *
 * Run `bun run gen:all` first on a fresh clone so the login templates exist.
 * Re-running gen:all after this restores GA from HEAD_ASSETS.
 */

import { statSync } from "node:fs";

const PLACEHOLDER_DOMAIN = "your-domain.com";
const DRY = process.argv.includes("--dry");

type Rule = {
    name: string;
    find: RegExp;
    replace?: string;
    optional?: boolean;
};

const ANALYTICS_RULES: Rule[] = [
    {
        name: "GA loader <script>",
        find: /[ \t]*<script\b[\s\S]*?googletagmanager[\s\S]*?<\/script>\n/,
    },
    {
        name: "GA inline config <script>",
        find: /[ \t]*<script>\s*window\.dataLayer[\s\S]*?<\/script>\n/,
    },
];

const GITHUB_LINKS_RULE: Rule = {
    name: "GitHub repo links",
    find: /[ \t]*<a\b[^>]*?href="https:\/\/github\.com\/akutishevsky\/nutrition-mcp"[\s\S]*?<\/a\s*>\n/g,
    optional: true,
};

const MAILTO_RULE: Rule = {
    name: "maintainer mailto links",
    find: /[ \t]*<a\b[^>]*?href="mailto:anton@nutrition-mcp\.com"[^>]*>[^<]*<\/a\s*>\n/g,
    optional: true,
};

const DOMAIN_RULE: Rule = {
    name: `domain nutrition-mcp.com -> ${PLACEHOLDER_DOMAIN}`,
    find: /nutrition-mcp\.com/g,
    replace: PLACEHOLDER_DOMAIN,
    optional: true,
};

const GLAMA_RULE: Rule = {
    name: "Glama connector-ownership route",
    find: /[ \t]*\/\/ Glama connector ownership verification\.[\s\S]*?app\.get\("\/\.well-known\/glama\.json"[\s\S]*?\n\}\);\n\n/,
};

const CSP_RULES: Rule[] = [
    {
        name: "CSP: connect-src GA + github hosts",
        find: / https:\/\/www\.google-analytics\.com https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com https:\/\/analytics\.google\.com https:\/\/www\.google\.com https:\/\/\*\.googletagmanager\.com https:\/\/api\.github\.com/,
        replace: "",
    },
    {
        name: "CSP: googletagmanager host (script-src + img-src)",
        find: / https:\/\/www\.googletagmanager\.com/g,
        replace: "",
    },
];

const WIDGET_SUPPORT_RULE: Rule = {
    name: "import widget: support email -> empty",
    find: /(\/\* support-contact:start \*\/\s*\n\s*const SUPPORT_EMAIL = )"[^"]*"/,
    replace: '$1""',
};

const LOGIN_RULES: Rule[] = [
    ...ANALYTICS_RULES,
    GITHUB_LINKS_RULE,
    MAILTO_RULE,
    DOMAIN_RULE,
];

const loginJobs: { path: string; rules: Rule[] }[] = [
    { path: "public/login.html", rules: LOGIN_RULES },
];

for (const entry of await Array.fromAsync(
    new Bun.Glob("*").scan({ cwd: "public", onlyFiles: false }),
)) {
    if (!statSync(`public/${entry}`, { throwIfNoEntry: false })?.isDirectory())
        continue;
    const path = `public/${entry}/login.html`;
    if (await Bun.file(path).exists()) {
        loginJobs.push({ path, rules: LOGIN_RULES });
    }
}
loginJobs.sort((a, b) => a.path.localeCompare(b.path));

const JOBS: { path: string; rules: Rule[] }[] = [
    ...loginJobs,
    { path: "public/robots.txt", rules: [DOMAIN_RULE] },
    { path: "src/index.ts", rules: [GLAMA_RULE, ...CSP_RULES] },
    {
        path: "public/widgets/src/templates/import-meals.html",
        rules: [WIDGET_SUPPORT_RULE],
    },
];

let hadWarning = false;

for (const job of JOBS) {
    const file = Bun.file(job.path);
    if (!(await file.exists())) {
        console.log(`  skip  ${job.path} (not found)`);
        continue;
    }
    let text = await file.text();
    const before = text;
    const report: string[] = [];

    for (const rule of job.rules) {
        const globalFind = new RegExp(
            rule.find.source,
            rule.find.flags.includes("g")
                ? rule.find.flags
                : rule.find.flags + "g",
        );
        const count = (text.match(globalFind) || []).length;
        text = text.replace(globalFind, rule.replace ?? "");
        if (count === 0) {
            if (rule.optional) {
                report.push(`    – 0×  ${rule.name}`);
            } else {
                hadWarning = true;
                report.push(`    ⚠ 0×  ${rule.name}`);
            }
        } else {
            report.push(`    ✓ ${count}×  ${rule.name}`);
        }
    }

    const changed = text !== before;
    console.log(`\n${changed ? "edit" : "  ok"}  ${job.path}`);
    report.forEach((line) => console.log(line));
    if (changed && !DRY) await Bun.write(job.path, text);
}

console.log(
    `\n${DRY ? "Dry run — no files written." : "Done."}` +
        (hadWarning
            ? "\n⚠ Some rules matched 0 times — the markup may have changed since this script was written; verify those spots by hand."
            : ""),
);
console.log(
    "Left for you: swap in your own favicon.ico, and replace the " +
        `${PLACEHOLDER_DOMAIN} placeholder with your real domain.`,
);
