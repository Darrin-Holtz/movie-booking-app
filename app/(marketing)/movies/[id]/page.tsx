"use client"

import Image from "next/image"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import BlurCircle from "@/components/BlurCircle"
import { StarIcon, HeartIcon, PlayCircleIcon } from "lucide-react"
import timeFormat from "@/lib/timeFormat"
import Link from "next/link"
import DateSelect from "@/components/DateSelect"
import MovieCard from "@/components/MovieCard"
import Loading from "@/components/Loading"

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
    poster_path?: string | null
    vote_average: number
    overview: string
    runtime?: number | null
    genres: MovieGenre[]
    release_date: string
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

const MovieDetails = () => {
    const params = useParams<{ id: string }>()
    const id = params.id

    const [show, setShow] = useState<ShowState | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

    const recommendedMovies = show?.movie.recommendations?.results ?? []
    const castMembers = show?.movie.credits?.cast ?? []
    const formattedRuntime = timeFormat(show?.movie.runtime)
    const formattedGenres = show?.movie.genres.map((genre) => genre.name).join(", ")
    const releaseYear = show?.movie.release_date ? show.movie.release_date.split("-")[0] : ""
    const movieFacts = [formattedRuntime, formattedGenres, releaseYear].filter(Boolean).join(" • ")

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
                        <button className="flex items-center gap-2 px-7 py-3 text-sm bg-gray-800 hover:bg-gray-900 transition rounded-md font-medium cursor-pointer active:scale-95">
                            <PlayCircleIcon className="w-5 h-5" />    
                            Watch Trailer
                        </button>
                        <Link href="#dateSelect" className="px-10 py-3 text-sm bg-red-700 hover:bg-red-500 transition rounded-md font-medium cursor-pointer active:scale-95">Buy Tickets</Link>
                        <button className="bg-gray-700 p-2.5 hover:bg-gray-400 rounded-full transition cursor-pointer active:scale-95">
                            <HeartIcon className={`w-5 h-5`} />
                        </button>
                    </div>
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
    )
}

export default MovieDetails