"use client";

import BlurCircle from "./BlurCircle";
import { useState } from "react";
import Image from "next/image";
import { PlayCircleIcon } from "lucide-react";
import type { TrailerItem } from "@/lib/tmdb";

interface TrailersSectionProps {
  trailers: TrailerItem[];
}

const getYoutubeEmbedUrl = (videoUrl: string) => {
  try {
    const url = new URL(videoUrl);
    const videoId = url.searchParams.get("v");

    if (!videoId) {
      return null;
    }

    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
  } catch {
    return null;
  }
};

const TrailersSection = ({ trailers }: TrailersSectionProps) => {
  const [currentTrailerIndex, setCurrentTrailerIndex] = useState(0);
  const activeTrailer = trailers[Math.min(currentTrailerIndex, Math.max(trailers.length - 1, 0))] ?? null;
  const activeTrailerEmbedUrl = activeTrailer ? getYoutubeEmbedUrl(activeTrailer.videoUrl) : null;

  return (
    <div className="px-6 md:px-16 lg:px-24 xl:px-44 py-20 overflow-hidden">
      <h2 className="text-lg font-medium text-gray-300 max-w-240">Trailers</h2>
      <div className="relative mt-6">
        <BlurCircle top="-100px" right="-100px" />
        {activeTrailer && activeTrailerEmbedUrl ? (
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-black">
            <div className="relative aspect-video w-full">
              <iframe
                key={activeTrailer.id}
                src={activeTrailerEmbedUrl}
                title={`${activeTrailer.title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No trailer available right now.</p>
        )}
      </div>
      <div className="group grid grid-cols-4 gap-4 md:gap-8 mt-8 max-w-3xl mx-auto">
        {trailers.map((trailer, index) => (
          <div
            key={trailer.image}
            className={`relative cursor-pointer transition duration-300 hover:-translate-y-1 max-md:h-60 md:max-h-60 ${
              currentTrailerIndex === index ? "ring-2 ring-red-500" : "group-hover:not-hover:opacity-50"
            }`}
            onClick={() => setCurrentTrailerIndex(index)}
          >
            <Image
              src={trailer.image}
              alt={trailer.title}
              width={320}
              height={180}
              className="h-full w-full rounded-lg object-cover brightness-75"
            />
            <PlayCircleIcon strokeWidth={1.6} className="absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transform md:h-12 md:w-8" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrailersSection;