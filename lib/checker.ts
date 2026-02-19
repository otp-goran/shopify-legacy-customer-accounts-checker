export type AccountType =
  | "new"
  | "legacy"
  | "password-protected"
  | "not-shopify"
  | "unknown"
  | "error";

export interface CheckResult {
  url: string;
  type: AccountType;
  status?: number;
  redirect?: string;
  note?: string;
  error?: string;
}

function normalizeUrl(input: string): string | null {
  let url = input.trim();
  if (!url) return null;
  if (url.startsWith("#")) return null;
  if (!url.startsWith("http")) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

const NEW_ACCOUNT_REDIRECT_PATTERNS = [
  "shopify.com/authentication",
  "/auth/login",
  "accounts.shopify.com",
];

function isNewAccountRedirect(url: string): boolean {
  return NEW_ACCOUNT_REDIRECT_PATTERNS.some((p) => url.includes(p));
}

function classifyFromBody(
  storeUrl: string,
  body: string,
  status: number
): CheckResult {
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

  const hasPasswordField =
    body.includes('type="password"') && body.includes("customer");

  if (hasNewSignal && !hasPasswordField) {
    return { url: storeUrl, type: "new", status };
  }

  if (hasPasswordField && hasLegacySignal) {
    return { url: storeUrl, type: "legacy", status };
  }

  if (hasNewSignal) {
    return { url: storeUrl, type: "new", status };
  }

  if (hasPasswordField) {
    return { url: storeUrl, type: "legacy", status };
  }

  if (
    body.includes("password-page") ||
    body.includes("storefront-password")
  ) {
    return {
      url: storeUrl,
      type: "password-protected",
      status,
      note: "Store is password-protected (not yet live)",
    };
  }

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

export async function checkStore(storeUrl: string): Promise<CheckResult> {
  const loginUrl = `${storeUrl}/account/login`;
  const maxRedirects = 6;
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  try {
    let currentUrl = loginUrl;
    let lastStatus = 0;

    for (let i = 0; i < maxRedirects; i++) {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        headers: { "User-Agent": ua },
      });

      lastStatus = response.status;
      const location = response.headers.get("location") || "";

      if (location && isNewAccountRedirect(location)) {
        return {
          url: storeUrl,
          type: "new",
          status: lastStatus,
          redirect: location,
        };
      }

      if (lastStatus >= 300 && lastStatus < 400 && location) {
        currentUrl = location.startsWith("http")
          ? location
          : new URL(location, currentUrl).href;
        continue;
      }

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

      if (lastStatus === 200) {
        const poweredBy = response.headers.get("x-powered-by") || "";
        const shopId = response.headers.get("x-shopid") || "";
        const serverTiming = response.headers.get("server-timing") || "";
        const isShopify =
          poweredBy.includes("Shopify") ||
          !!shopId ||
          serverTiming.includes("shopify") ||
          serverTiming.includes("pageType");

        const body = await response.text();

        if (
          !isShopify &&
          !body.includes("Shopify") &&
          !body.includes("myshopify")
        ) {
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
    return {
      url: storeUrl,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function parseUrls(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map(normalizeUrl)
    .filter((u): u is string => u !== null);
}
