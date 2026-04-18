import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
};

export const getAppUrl = () => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000"
  );
};