#!/usr/bin/env node

import { readFileSync } from "fs";
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  options: {
    file: { type: "string", short: "f" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || (positionals.length === 0 && !values.file)) {
  console.log(`Usage:
  node check.js <store-url>              Check a single store
  node check.js <url1> <url2> ...        Check multiple stores
  node check.js -f <file>                Check stores from a file (one URL per line)

Examples:
  node check.js mystore.myshopify.com
  node check.js https://example-store.com
  node check.js -f stores.txt`);
  process.exit(0);
}

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return null;
  if (url.startsWith("#")) return null;
  if (!url.startsWith("http")) url = `https://${url}`;
  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  return url;
}

const NEW_ACCOUNT_REDIRECT_PATTERNS = [
  "shopify.com/authentication",
  "/auth/login",
  "accounts.shopify.com",
];

function isNewAccountRedirect(url) {
  return NEW_ACCOUNT_REDIRECT_PATTERNS.some((p) => url.includes(p));
}

async function checkStore(storeUrl) {
  const loginUrl = `${storeUrl}/account/login`;
  const maxRedirects = 6;
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  try {
    let currentUrl = loginUrl;
    let lastStatus;

    for (let i = 0; i < maxRedirects; i++) {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        headers: { "User-Agent": ua },
      });

      lastStatus = response.status;
      const location = response.headers.get("location") || "";

      // Check if redirect points to Shopify's new auth
      if (location && isNewAccountRedirect(location)) {
        return { url: storeUrl, type: "new", status: lastStatus, redirect: location };
      }

      // Follow redirect
      if (lastStatus >= 300 && lastStatus < 400 && location) {
        currentUrl = location.startsWith("http")
          ? location
          : new URL(location, currentUrl).href;
        continue;
      }

      // 406 from a different domain than the store = new accounts with custom domain
      // Shopify's new customer accounts on custom domains return 406 for non-browser requests
      if (lastStatus === 406 && currentUrl !== loginUrl) {
        const redirectHost = new URL(currentUrl).hostname;
        const storeHost = new URL(storeUrl).hostname;
        if (redirectHost !== storeHost) {
          return {
            url: storeUrl,
            type: "new",
            status: lastStatus,
            note: `Redirected to custom account domain: ${redirectHost}`,
          };
        }
      }

      // Got a final response — read the body
      if (lastStatus === 200) {
        // Quick Shopify check via headers
        const poweredBy = response.headers.get("x-powered-by") || "";
        const shopId = response.headers.get("x-shopid") || "";
        const serverTiming = response.headers.get("server-timing") || "";
        const isShopify =
          poweredBy.includes("Shopify") ||
          shopId ||
          serverTiming.includes("shopify") ||
          serverTiming.includes("pageType");

        const body = await response.text();

        if (!isShopify && !body.includes("Shopify") && !body.includes("myshopify")) {
          return {
            url: storeUrl,
            type: "not-shopify",
            status: lastStatus,
            note: "Does not appear to be a Shopify store",
          };
        }

        return classifyFromBody(storeUrl, body, lastStatus);
      }

      if (lastStatus === 404) {
        return {
          url: storeUrl,
          type: "not-shopify",
          status: lastStatus,
          note: "No /account/login page found — likely not a Shopify store",
        };
      }

      return {
        url: storeUrl,
        type: "unknown",
        status: lastStatus,
        note: `Unexpected status ${lastStatus} at ${currentUrl}`,
      };
    }

    return {
      url: storeUrl,
      type: "unknown",
      status: lastStatus,
      note: "Too many redirects",
    };
  } catch (err) {
    return { url: storeUrl, type: "error", error: err.message };
  }
}

function classifyFromBody(storeUrl, body, status) {
  // New customer accounts indicators (Shopify's new auth system)
  const newAccountSignals = [
    "shopify.com/authentication",
    "accounts.shopify.com",
    "init-customer-accounts",
    "initCustomerAccounts",
    "init-shop-for-new-customer-accounts",
    "shopify-login",
    "SignInWithShop",
  ];

  const hasNewSignal = newAccountSignals.some((signal) =>
    body.includes(signal)
  );

  // Legacy accounts indicators
  const legacySignals = [
    'customer[password]',
    "customer_login",
    'name="customer[email]"',
    'action="/account/login"',
    'action="/account"',
  ];

  const hasLegacySignal = legacySignals.some((signal) =>
    body.includes(signal)
  );

  // Check for password field (traditional login form)
  const hasPasswordField =
    body.includes('type="password"') && body.includes("customer");

  // New accounts with Shop login (no password field, uses Shopify auth)
  if (hasNewSignal && !hasPasswordField) {
    return { url: storeUrl, type: "new", status };
  }

  // Legacy accounts: has password field and legacy form markers
  if (hasPasswordField && hasLegacySignal) {
    return { url: storeUrl, type: "legacy", status };
  }

  // New accounts: has new signals even with some legacy-looking markup
  // (some themes include both but the new system takes over)
  if (hasNewSignal) {
    return { url: storeUrl, type: "new", status };
  }

  // Legacy fallback: has a password field
  if (hasPasswordField) {
    return { url: storeUrl, type: "legacy", status };
  }

  // Check for password-protected storefront (not the same thing)
  if (body.includes("password-page") || body.includes("storefront-password")) {
    return {
      url: storeUrl,
      type: "password-protected",
      status,
      note: "Store is password-protected (not yet live)",
    };
  }

  // Check if it's even a Shopify store
  if (!body.includes("Shopify") && !body.includes("shopify")) {
    return {
      url: storeUrl,
      type: "not-shopify",
      status,
      note: "Does not appear to be a Shopify store",
    };
  }

  return {
    url: storeUrl,
    type: "unknown",
    status,
    note: "Could not determine account type from page content",
  };
}

// Gather URLs
let urls = [];

if (values.file) {
  const content = readFileSync(values.file, "utf-8");
  urls = content
    .split("\n")
    .map(normalizeUrl)
    .filter((u) => u !== null);
}

urls.push(...positionals.map(normalizeUrl).filter((u) => u !== null));

if (urls.length === 0) {
  console.error("No valid URLs provided.");
  process.exit(1);
}

console.log(`Checking ${urls.length} store(s)...\n`);

// Process with concurrency limit
const CONCURRENCY = 5;
const results = [];

for (let i = 0; i < urls.length; i += CONCURRENCY) {
  const batch = urls.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.all(batch.map(checkStore));
  results.push(...batchResults);
}

// Output results
const typeLabels = {
  new: "NEW Customer Accounts",
  legacy: "LEGACY Customer Accounts",
  "password-protected": "PASSWORD PROTECTED",
  "not-shopify": "NOT A SHOPIFY STORE",
  unknown: "UNKNOWN",
  error: "ERROR",
};

const typeIcons = {
  new: "\u2728",
  legacy: "\u{1F527}",
  "password-protected": "\u{1F512}",
  "not-shopify": "\u{1F6AB}",
  unknown: "\u2753",
  error: "\u274C",
};

for (const r of results) {
  const icon = typeIcons[r.type] || "?";
  const label = typeLabels[r.type] || r.type;
  let line = `${icon} ${r.url} — ${label}`;
  if (r.note) line += ` (${r.note})`;
  if (r.error) line += ` (${r.error})`;
  console.log(line);
}

// Summary
console.log("\n--- Summary ---");
const counts = {};
for (const r of results) {
  counts[r.type] = (counts[r.type] || 0) + 1;
}
for (const [type, count] of Object.entries(counts)) {
  console.log(`  ${typeLabels[type] || type}: ${count}`);
}
