import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { getAppUrl, getStripe } from "@/lib/stripe";

type CheckoutRequestBody = {
  bookingIds?: string[];
};

export async function POST(request: Request) {
  let body: CheckoutRequestBody;

  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.bookingIds) || body.bookingIds.length === 0) {
    return Response.json(
      { error: "Select at least one held booking to continue." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const checkout = await fetchAuthMutation(api.payments.prepareCheckout, {
      bookingIds: body.bookingIds as Id<"showSessions">[],
    });
    const appUrl = getAppUrl();

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout?canceled=1`,
      customer_email: checkout.customerEmail ?? undefined,
      line_items: checkout.items.map((item) => ({
        quantity: item.seatLabels.length,
        price_data: {
          currency: checkout.currency,
          unit_amount: Math.round(item.seatPrice * 100),
          product_data: {
            name: `${item.movieTitle} • ${item.date} • ${item.time}`,
            description: `Seats ${item.seatLabels.join(", ")}`,
            images: item.posterPath
              ? [`https://image.tmdb.org/t/p/w500${item.posterPath}`]
              : undefined,
          },
        },
      })),
      metadata: {
        convexCheckoutId: checkout.checkoutId,
        seatCount: String(
          checkout.items.reduce((sum, item) => sum + item.seatLabels.length, 0)
        ),
      },
      payment_intent_data: {
        metadata: {
          convexCheckoutId: checkout.checkoutId,
        },
      },
    });

    await fetchAuthMutation(api.payments.attachStripeCheckoutSession, {
      checkoutId: checkout.checkoutId,
      stripeCheckoutSessionId: stripeSession.id,
    });

    if (!stripeSession.url) {
      return Response.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    return Response.json({ url: stripeSession.url });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Stripe checkout.",
      },
      { status: 500 }
    );
  }
}