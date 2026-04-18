"use client";

import { useQuery } from "convex/react";
import { ArrowRightIcon, HeartIcon } from "lucide-react";
import Link from "next/link";
import Loading from "@/components/Loading";
import MovieCard from "@/components/MovieCard";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

type FavoriteMovie = {
    _id: string;
    movieId: string;
    movieTitle: string;
    posterPath?: string;
    backdropPath?: string;
    releaseDate?: string;
    voteAverage?: number;
    updatedAt: number;
};

export default function FavoritePage() {
    const { data: session, isPending } = authClient.useSession();
    const favorites = useQuery(
        api.favorites.getMyFavorites,
        session?.session ? {} : "skip"
    ) as FavoriteMovie[] | undefined;

    if (isPending) {
        return <Loading />;
    }

    if (!session?.session) {
        return (
            <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_36%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
                <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
                            <HeartIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Favorites</p>
                            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Keep favorites personal.</h1>
                        </div>
                    </div>

                    <p className="mt-6 max-w-2xl text-white/65">
                        Favorites work better as a per-user list than a public page. Sign in to save movies and keep the list synced to your account.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-4">
                        <Link
                            href="/sign-in"
                            className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
                        >
                            Sign in
                            <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
                        </Link>
                        <Link
                            href="/movies"
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
                        >
                            Browse movies
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!favorites) {
        return <Loading />;
    }

    if (favorites.length === 0) {
        return (
            <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_36%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
                <div className="mx-auto max-w-5xl rounded-3xl border border-dashed border-white/10 bg-white/4 p-10 text-center shadow-xl shadow-black/25">
                    <HeartIcon className="mx-auto h-10 w-10 text-red-300/80" />
                    <h1 className="mt-5 text-3xl font-semibold">No favorites saved yet.</h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
                        Use the heart icon on any movie page to build your own shortlist.
                    </p>
                    <Link
                        href="/movies"
                        className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                        Explore movies
                        <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_36%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
            <div className="mx-auto max-w-6xl space-y-8">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Favorites</p>
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h1 className="text-4xl font-semibold tracking-tight">Your saved movies.</h1>
                            <p className="mt-3 max-w-2xl text-sm text-white/65">
                                This list is tied to your account, so your favorites stay personal across devices and sessions.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                            <p className="text-white/55">Saved titles</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{favorites.length}</p>
                        </div>
                    </div>
                </section>

                <section className="flex flex-wrap gap-8 max-sm:justify-center">
                    {favorites.map((movie) => (
                        <MovieCard
                            key={movie._id}
                            movie={{
                                id: Number(movie.movieId),
                                title: movie.movieTitle,
                                backdrop_path: movie.backdropPath ?? movie.posterPath ?? null,
                                release_date: movie.releaseDate ?? "",
                                vote_average: movie.voteAverage ?? 0,
                            }}
                        />
                    ))}
                </section>
            </div>
        </main>
    );
}