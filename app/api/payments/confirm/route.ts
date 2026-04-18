import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe";

type ConfirmCheckoutRequestBody = {
  sessionId?: string;
};

export async function POST(request: Request) {
  let body: ConfirmCheckoutRequestBody;

  try {
    body = (await request.json()) as ConfirmCheckoutRequestBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.sessionId) {
    return Response.json({ error: "Missing Stripe session ID." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);

    if (session.payment_status !== "paid" || session.status !== "complete") {
      return Response.json(
        { error: "Stripe session is not paid yet." },
        { status: 409 }
      );
    }

    const result = await fetchAuthMutation(api.payments.confirmPaidCheckout, {
      checkoutId:
        typeof session.metadata?.convexCheckoutId === "string"
          ? (session.metadata.convexCheckoutId as Id<"paymentCheckouts">)
          : undefined,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm Stripe checkout.",
      },
      { status: 500 }
    );
  }
}