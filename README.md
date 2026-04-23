# QuickShow

QuickShow is a movie booking demo built with Next.js App Router, Convex, Better Auth, and TMDB. It covers the core ticketing journey from discovery to seat hold, along with account management and favorites.

## What It Includes

- Home page with featured movies and trailers.
- Browse flow with local filters plus TMDB-backed title search.
- Movie detail pages with cast, recommendations, and trailer playback.
- Date and session selection with server-backed seat holds in Convex.
- Account, favorites, bookings, Stripe checkout, and confirmation flows.
- Mobile tickets with real QR codes plus a staff scan flow.
- Upcoming and past booking sections that switch over after a movie ends.
- Lightweight analytics hooks for key funnel events.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Convex
- Better Auth
- TMDB API

## Environment

Create a `.env.local` file with the following values:

```bash
TMDB_API_KEY=your_tmdb_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`NEXT_PUBLIC_APP_URL` is optional locally, but it is used for canonical metadata and share previews.
`SITE_URL` should match your deployed app origin. Better Auth uses it for auth callbacks and server-side links use it outside request scope.
`STRIPE_WEBHOOK_SECRET` should match the signing secret for the specific Stripe webhook endpoint that points at your Convex deployment's `/stripe/webhook` endpoint.
Because the webhook handler runs in Convex, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must also be set in the active Convex deployment with `npx convex env set`.

Ticket staff is managed inside the app now:

- The first signed-in user can claim the first ticket staff slot from the account page.
- After that, ticket staff can add or remove other staff emails from the same account page.
- The scan screen supports live camera QR scanning when the browser supports it, and photo upload as a fallback on phones that do not support live detection.

## Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## Production Notes

- The app builds cleanly with `pnpm build`.
- In Vercel, set both `NEXT_PUBLIC_APP_URL` and `SITE_URL` to your production domain so metadata, auth callbacks, and non-request server links resolve correctly.
- TMDB requests are centralized in `lib/tmdb.ts` with safer fallbacks for missing keys, bad responses, and timeouts.
- Layout metadata is set up for real app titles, descriptions, and social previews.
- Analytics events are exposed through `lib/analytics.ts` and `components/AnalyticsProvider.tsx`.
- Stripe checkout creation lives in `app/api/payments/checkout/route.ts`, while webhook confirmation runs through `convex/http.ts` and `convex/payments.ts`.
- Booking status timing is based on `America/New_York`.
- Confirmed tickets stay in Upcoming until the movie end time, then move into Past Bookings.

## Current Limitations

- Analytics events are emitted to `window.dataLayer` and browser custom events, but no external analytics sink is configured yet.
- Stripe requires local or deployed webhook configuration before payment confirmation will complete automatically.
- Staff management is handled in-app, but there is not yet a separate dedicated staff dashboard.

## Verification

Run these checks before shipping changes:

```bash
pnpm lint
pnpm build
```
