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

    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
  } catch {
    return null;
  }
};

const TrailersSection = ({ trailers }: TrailersSectionProps) => {
  const [currentTrailerIndex, setCurrentTrailerIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeTrailer = trailers[Math.min(currentTrailerIndex, Math.max(trailers.length - 1, 0))] ?? null;
  const activeTrailerEmbedUrl = activeTrailer ? getYoutubeEmbedUrl(activeTrailer.videoUrl) : null;

  const handleSelectTrailer = (index: number) => {
    setCurrentTrailerIndex(index);
    setIsPlaying(false);
  };

  return (
    <div className="px-6 md:px-16 lg:px-24 xl:px-44 py-20 overflow-hidden">
      <h2 className="text-lg font-medium text-gray-300 max-w-240">Trailers</h2>
      <div className="relative mt-6">
        <BlurCircle top="-100px" right="-100px" />
        {activeTrailer && activeTrailerEmbedUrl ? (
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-black">
            <div className="relative aspect-video w-full">
              {isPlaying ? (
                <iframe
                  key={activeTrailer.id}
                  src={activeTrailerEmbedUrl}
                  title={`${activeTrailer.title} trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="group absolute inset-0 h-full w-full"
                  aria-label={`Play ${activeTrailer.title} trailer`}
                >
                  <Image
                    src={activeTrailer.image}
                    alt={activeTrailer.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover brightness-75"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition group-hover:bg-red-700/80">
                      <PlayCircleIcon strokeWidth={1.4} className="h-10 w-10 text-white" />
                    </span>
                  </span>
                </button>
              )}
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
            onClick={() => handleSelectTrailer(index)}
          >
            <Image
              src={trailer.image}
              alt={trailer.title}
              width={160}
              height={90}
              sizes="(max-width: 768px) 22vw, 168px"
              className="h-full w-full rounded-lg object-cover brightness-75"
            />
            <PlayCircleIcon strokeWidth={1.6} className="absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transform md:h-12 md:w-8" />
            <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-xs font-medium text-white line-clamp-2">
              {trailer.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrailersSection;
