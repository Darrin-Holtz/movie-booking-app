import { Suspense } from "react";
import FeaturedSection from "@/components/FeaturedSection";
import { HeroSection } from "@/components/HeroSection";
import TrailersSection from "@/components/TrailersSection";
import { getPopularTrailers } from "@/lib/tmdb";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "QuickShow",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/movies?q={search_term_string}&mode=search`,
    },
    "query-input": "required name=search_term_string",
  },
};

async function HomeTrailersSection() {
  const trailers = await getPopularTrailers();

  return <TrailersSection trailers={trailers} />;
}

function HeroFallback() {
  return (
    <section className="flex min-h-screen flex-col items-start justify-center gap-4 bg-black px-6 text-white md:px-16 lg:px-30">
      <div className="h-16 w-72 animate-pulse rounded bg-white/10 md:h-24 md:w-96" />
      <div className="h-5 w-80 animate-pulse rounded bg-white/10" />
      <div className="h-5 w-64 animate-pulse rounded bg-white/10" />
      <div className="h-12 w-40 animate-pulse rounded-full bg-white/10" />
    </section>
  );
}

function SectionFallback() {
  return (
    <section className="overflow-hidden px-6 py-20 md:px-16 lg:px-24 xl:px-44">
      <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="aspect-2/3 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema).replace(/<\/script>/gi, "<\\/script>"),
        }}
      />
      <Suspense fallback={<HeroFallback />}>
        <HeroSection />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <FeaturedSection />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <HomeTrailersSection />
      </Suspense>
    </>
  );
}