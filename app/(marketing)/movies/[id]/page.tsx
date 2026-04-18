"use client"

import { useMutation, useQuery } from "convex/react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import BlurCircle from "@/components/BlurCircle"
import { HeartIcon, PlayCircleIcon, StarIcon, XIcon } from "lucide-react"
import Loading from "@/components/Loading"
import timeFormat from "@/lib/timeFormat"
import DateSelect from "@/components/DateSelect"
import MovieCard from "@/components/MovieCard"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"

type MovieGenre = {
    id: number
    name: string
}

type MovieCastMember = {
    id: number
    name: string
    profile_path?: string | null
}

type RecommendedMovie = {
    id: number
    title: string
    release_date: string
    backdrop_path: string | null
    vote_average: number
    genre_names?: string[]
    runtime?: number
}

type MovieDetailsResponse = {
    title: string
    backdrop_path?: string | null
    poster_path?: string | null
    vote_average: number
    overview: string
    runtime?: number | null
    genres: MovieGenre[]
    release_date: string
    trailerUrl?: string | null
    credits?: {
        cast?: MovieCastMember[]
    }
    recommendations?: {
        results?: RecommendedMovie[]
    }
}

type ShowState = {
    movie: MovieDetailsResponse,
    dateTime: Date
}

type FavoriteState = {
    isFavorite: boolean
}

const getYoutubeEmbedUrl = (videoUrl?: string | null) => {
    if (!videoUrl) {
        return null
    }

    try {
        const url = new URL(videoUrl)
        const videoId = url.searchParams.get("v")

        if (!videoId) {
            return null
        }

        return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`
    } catch {
        return null
    }
}

const MovieDetails = () => {
    const router = useRouter()
    const params = useParams<{ id: string }>()
    const id = params.id
    const { data: session, isPending: isAuthPending } = authClient.useSession()
    const addFavorite = useMutation(api.favorites.addFavorite)
    const removeFavorite = useMutation(api.favorites.removeFavorite)
    const favoriteState = useQuery(
        api.favorites.isFavorite,
        session?.session && id ? { movieId: id } : "skip"
    ) as FavoriteState | undefined

    const [show, setShow] = useState<ShowState | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isTrailerOpen, setIsTrailerOpen] = useState(false)
    const [isFavoriteSubmitting, setIsFavoriteSubmitting] = useState(false)

    useEffect(() => {
        if (!id) {
            setShow(null)
            setErrorMessage("Invalid movie id.")
            return
        }

        const fetchMovie = async () => {
            try {
                const res = await fetch(`/api/movies/${id}`)

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null)
                    throw new Error(errorData?.error ?? "Failed to load movie details.")
                }

                const data = await res.json()
                setShow({
                    movie: data,
                    dateTime: new Date()
                })
                setErrorMessage(null)
            } catch (error) {
                console.error(error)
                setShow(null)
                setErrorMessage(error instanceof Error ? error.message : "Failed to load movie details.")
            }
        }

        fetchMovie()
    }, [id])

    useEffect(() => {
        if (!isTrailerOpen) {
            return
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsTrailerOpen(false)
            }
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [isTrailerOpen])

    const recommendedMovies = show?.movie.recommendations?.results ?? []
    const castMembers = show?.movie.credits?.cast ?? []
    const formattedRuntime = timeFormat(show?.movie.runtime)
    const formattedGenres = show?.movie.genres.map((genre) => genre.name).join(", ")
    const releaseYear = show?.movie.release_date ? show.movie.release_date.split("-")[0] : ""
    const movieFacts = [formattedRuntime, formattedGenres, releaseYear].filter(Boolean).join(" • ")
    const trailerEmbedUrl = getYoutubeEmbedUrl(show?.movie.trailerUrl)
    const isFavorite = favoriteState?.isFavorite ?? false

    const handleTrailerOpen = () => {
        if (!trailerEmbedUrl) {
            toast.error("No trailer is available for this movie yet.")
            return
        }

        setIsTrailerOpen(true)
    }

    const handleFavoriteToggle = async () => {
        if (!id || !show) {
            return
        }

        if (!session?.session) {
            toast.error("Sign in to save favorites.")
            router.push("/sign-in")
            return
        }

        setIsFavoriteSubmitting(true)

        try {
            if (isFavorite) {
                await removeFavorite({ movieId: id })
                toast.success("Removed from favorites")
            } else {
                await addFavorite({
                    movieId: id,
                    movieTitle: show.movie.title,
                    posterPath: show.movie.poster_path ?? undefined,
                    backdropPath: show.movie.backdrop_path ?? undefined,
                    releaseDate: show.movie.release_date || undefined,
                    voteAverage: show.movie.vote_average,
                })
                toast.success("Added to favorites")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update favorites.")
        } finally {
            setIsFavoriteSubmitting(false)
        }
    }

    if (errorMessage) {
        return (
            <div className="flex flex-col items-center justify-center h-screen px-6">
                <h1 className="text-3xl font-bold text-center">Unable to load movie details.</h1>
                <p className="mt-3 text-sm text-gray-400 text-center">{errorMessage}</p>
            </div>
        )
    }

    if (!show || !id) {
        return <Loading />
    }

    return (
        <>
            <div className="px-6 md:px-16 lg:px-40 pt-30 md:pt-50">
                <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
                    <Image
                        src={show.movie.poster_path
                            ? `https://image.tmdb.org/t/p/w500${show.movie.poster_path}`
                            : "/fallback-movie.jpg"}
                        alt={show.movie.title}
                        width={500}
                        height={750}
                        className="max-md:mx-auto rounded-xl h-104 max-w-70 object-cover"
                    />
                    <div className="relative flex flex-col gap-3">
                        <BlurCircle top="-100px" right="-100px" />
                        <p className="text-white">English</p>
                        <h1 className="text-4xl font-semibold max-w-96 text-balance">{show.movie.title}</h1>
                        <div className="flex items-center gap-2 text-gray-300">
                            <StarIcon className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                            <span>{show.movie.vote_average.toFixed(1)} User Ratings</span>
                        </div>
                        <p className="text-gray-400 max-w-xl text-sm leading-tight">{show.movie.overview}</p>
                        {movieFacts && <p>{movieFacts}</p>}
                        <div className="flex items-center gap-4 mt-4 flex-wrap">
                            <button
                                className="flex items-center gap-2 px-7 py-3 text-sm bg-gray-800 hover:bg-gray-900 transition rounded-md font-medium cursor-pointer active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={handleTrailerOpen}
                                disabled={!trailerEmbedUrl}
                                type="button"
                            >
                                <PlayCircleIcon className="w-5 h-5" />
                                {trailerEmbedUrl ? "Watch Trailer" : "Trailer Unavailable"}
                            </button>
                            <Link href="#dateSelect" className="px-10 py-3 text-sm bg-red-700 hover:bg-red-500 transition rounded-md font-medium cursor-pointer active:scale-95">Buy Tickets</Link>
                            <button
                                className={`p-2.5 rounded-full transition cursor-pointer active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                                    isFavorite
                                        ? "bg-red-800 hover:bg-red-700"
                                        : "bg-gray-700 hover:bg-gray-500"
                                }`}
                                onClick={handleFavoriteToggle}
                                disabled={isFavoriteSubmitting || isAuthPending}
                                type="button"
                                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            >
                                <HeartIcon className={`w-5 h-5 ${isFavorite ? "fill-white text-white" : "text-white"}`} />
                            </button>
                        </div>
                        {!session?.session ? (
                            <p className="text-sm text-gray-400">
                                Sign in to save favorites and keep them synced to your account.
                            </p>
                        ) : null}
                    </div>
                </div>
                {castMembers.length > 0 && (
                    <div className="mt-20 max-w-6xl mx-auto">
                        <p className="text-sm text-gray-400 mb-2">Your Favorite Cast</p>
                        <div className="flex flex-wrap gap-3">
                            {castMembers.slice(0, 12).map((member) => (
                                <div key={member.id} className="flex flex-col items-center gap-1 w-16">
                                    <Image
                                        src={member.profile_path
                                            ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
                                            : "/fallback-avatar.jpg"}
                                        alt={member.name}
                                        width={64}
                                        height={64}
                                        className="rounded-full w-12 h-12 object-cover"
                                    />
                                    <span className="text-xs text-gray-300 text-center leading-tight">{member.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <DateSelect dateTime={show.dateTime} movieId={id}/>
                <h3 className="text-lg font-medium mt-20 mb-8">You May Also Like</h3>
                <div className="flex flex-wrap max-sm:justify-center gap-8">
                    {recommendedMovies.slice(0, 4).map((movie) => (
                        <MovieCard key={movie.id} movie={movie} />
                    ))}
                </div>
                <div className="flex justify-center mt-20">
                <Link href="/movies" className="px-10 py-3 text-sm bg-red-700 hover:bg-red-500 transition rounded-md font-medium cursor-pointer">
                    Show More
                </Link>
                </div>
            </div>

            {isTrailerOpen && trailerEmbedUrl ? (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 px-4">
                    <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#090909] shadow-2xl shadow-black/60">
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                            <div>
                                <p className="text-sm uppercase tracking-[0.25em] text-red-300/80">Trailer</p>
                                <h2 className="mt-1 text-xl font-semibold text-white">{show.movie.title}</h2>
                            </div>
                            <button
                                className="rounded-full border border-white/10 p-2 text-white transition hover:bg-white/5"
                                onClick={() => setIsTrailerOpen(false)}
                                type="button"
                                aria-label="Close trailer"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="relative aspect-video w-full bg-black">
                            <iframe
                                src={trailerEmbedUrl}
                                title={`${show.movie.title} trailer`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="absolute inset-0 h-full w-full border-0"
                                referrerPolicy="strict-origin-when-cross-origin"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}

export default MovieDetails