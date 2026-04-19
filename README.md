# QuickShow

QuickShow is a movie booking demo built with Next.js App Router, Convex, Better Auth, and TMDB. It covers the core ticketing journey from discovery to seat hold, along with account management and favorites.

## What It Includes

- Home page with featured movies and trailers.
- Browse flow with local filters plus TMDB-backed title search.
- Movie detail pages with cast, recommendations, and trailer playback.
- Date and session selection with server-backed seat holds in Convex.
- Account, favorites, bookings, Stripe checkout, and confirmation flows.
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
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`NEXT_PUBLIC_APP_URL` is optional locally, but it is used for canonical metadata and share previews.
`STRIPE_WEBHOOK_SECRET` should match the signing secret for the specific Stripe webhook endpoint that points at your Convex deployment's `/stripe/webhook` endpoint.
Because the webhook handler runs in Convex, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must also be set in the active Convex deployment with `npx convex env set`.

## Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## Production Notes

- The app builds cleanly with `pnpm build`.
- TMDB requests are centralized in `lib/tmdb.ts` with safer fallbacks for missing keys, bad responses, and timeouts.
- Layout metadata is set up for real app titles, descriptions, and social previews.
- Analytics events are exposed through `lib/analytics.ts` and `components/AnalyticsProvider.tsx`.
- Stripe checkout creation lives in `app/api/payments/checkout/route.ts`, while webhook confirmation runs through `convex/http.ts` and `convex/payments.ts`.

## Current Limitations

- Analytics events are emitted to `window.dataLayer` and browser custom events, but no external analytics sink is configured yet.
- Stripe requires local or deployed webhook configuration before payment confirmation will complete automatically.

## Verification

Run these checks before shipping changes:

```bash
pnpm lint
pnpm build
```
