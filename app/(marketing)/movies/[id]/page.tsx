import type { Metadata } from "next";
import { getMovieDetails } from "@/lib/tmdb";
import MovieDetailsClient from "./MovieDetailsClient";

type PageProps = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const movie = await getMovieDetails(id);

    if (!movie) {
        return { title: "Movie Not Found" };
    }

    const imageUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : undefined;

    return {
        title: movie.title,
        description: movie.overview,
        openGraph: {
            title: movie.title,
            description: movie.overview,
            images: imageUrl ? [{ url: imageUrl, width: 500, height: 750 }] : [],
        },
        twitter: {
            card: "summary",
            title: movie.title,
            description: movie.overview,
            images: imageUrl ? [imageUrl] : [],
        },
    };
}

export default async function MovieDetailsPage({ params }: PageProps) {
    const { id } = await params;
    const movie = await getMovieDetails(id);

    const jsonLd = movie
        ? {
              "@context": "https://schema.org",
              "@type": "Movie",
              name: movie.title,
              description: movie.overview,
              image: movie.poster_path
                  ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                  : undefined,
              datePublished: movie.release_date,
              genre: movie.genres.map((g) => g.name),
              aggregateRating:
                  movie.vote_average > 0
                      ? {
                            "@type": "AggregateRating",
                            ratingValue: movie.vote_average.toFixed(1),
                            bestRating: "10",
                            worstRating: "0",
                        }
                      : undefined,
          }
        : null;

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, "<\\/script>"),
                    }}
                />
            )}
            <MovieDetailsClient />
        </>
    );
}
