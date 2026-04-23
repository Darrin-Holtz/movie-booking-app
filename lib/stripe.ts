import Stripe from "stripe";

let stripeClient: Stripe | null = null;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getRequestOrigin = (request: Request) => {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";

    if (host) {
      return trimTrailingSlash(`${proto}://${host}`);
    }
  }

  return trimTrailingSlash(new URL(request.url).origin);
};

export const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
};

export const getAppUrl = (request?: Request) => {
  if (request) {
    return getRequestOrigin(request);
  }

  const configuredAppUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

  return trimTrailingSlash(configuredAppUrl || "http://localhost:3000");
};