import FeaturedSection from "@/components/FeaturedSection";
import { HeroSection } from "@/components/HeroSection";
import TrailersSection from "@/components/TrailersSection";
import { getPopularTrailers } from "@/lib/tmdb";

export default async function HomePage() {
  const trailers = await getPopularTrailers();

  return (
    <>
      <HeroSection />
      <FeaturedSection />
      <TrailersSection trailers={trailers} />
    </>
  );
}