"use client"

import Image from "next/image"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import BlurCircle from "@/components/BlurCircle"
import { StarIcon, HeartIcon, PlayCircleIcon } from "lucide-react"
import timeFormat from "@/lib/timeFormat"
import Link from "next/link"

type ShowState = {
    movie: any,
    dateTime: Date
}

const MovieDetails = () => {
    const {id} = useParams() 
    const [show, setShow] = useState<ShowState | null>(null)
    const getShow = async () => {
        try {
            const res = await fetch(`/api/movies/${id}`)
             
            const data = await res.json()
            setShow({
                movie: data,
                dateTime: new Date()
            })
            
        } catch (error) {
            console.error( error)
        }
    }

    useEffect(() => {
        getShow()
    }, [id])

    return show ? (
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
                    <p>
                    {timeFormat(show.movie.runtime)} • {show.movie.genres.map((genre: any) => genre.name).join(", ")} • {show.movie.release_date.split("-")[0]}
                    </p>                    
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
            {show.movie.credits?.cast?.length > 0 && (
                <div className="mt-20 max-w-6xl mx-auto">
                    <p className="text-sm text-gray-400 mb-2">Your Favorite Cast</p>
                    <div className="flex flex-wrap gap-3">
                        {(show.movie.credits.cast as any[]).slice(0, 12).map((member) => (
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
        </div>
    ) : (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-3xl font-bold text-center">
                Loading movie details...
            </h1>
        </div>
    )
}

export default MovieDetails