"use client";

import { Cog, LogOut, MenuIcon, SearchIcon, TicketPlus, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth-client";

const Navbar = () => {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!accountMenuRef.current) {
                return;
            }

            if (!accountMenuRef.current.contains(event.target as Node)) {
                setIsAccountMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const avatarLabel =
        session?.user.name
            ?.split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || session?.user.email?.slice(0, 2).toUpperCase() || "QS";

    const renderAvatar = (className: string) => {
        if (session?.user.image) {
            return (
                <span
                    aria-label={session.user.name || "User avatar"}
                    className={className}
                    role="img"
                    style={{ backgroundImage: `url(${session.user.image})` }}
                />
            );
        }

        return avatarLabel;
    };

    const handleNavClick = () => {
        window.scrollTo(0, 0);
        setIsOpen(false);
        setIsAccountMenuOpen(false);
    };

    const handleSignOut = async () => {
        setIsSigningOut(true);

        const result = await authClient.signOut();

        setIsSigningOut(false);

        if (result.error) {
            toast.error(result.error.message || "Unable to sign out");
            return;
        }

        toast.success("Signed out");
        setIsOpen(false);
        setIsAccountMenuOpen(false);
        router.push("/");
        router.refresh();
    };

  return (
    <nav className="fixed top-0 left-0 z-50 w-full flex items-center justify-between px-6 md:px-16 lg:px-36 py-5">
            <Link href="/" className="max-xl:flex-1">
                <div className="text-3xl font-bold">
                    Quick<span className="text-red-800">Show</span>
                </div>
            </Link>
            <div
                className={`max-xl:absolute max-xl:top-0 max-xl:left-0 max-xl:font-medium max-xl:text-lg z-50 flex flex-col xl:flex-row items-center max-xl:justify-center gap-8 xl:px-8 py-3 max-xl:h-screen xl:rounded-full backdrop-blur bg-black/70 xl:bg-white/10 xl:border border-gray-300/20 overflow-hidden transition-[width] duration-300 ${isOpen ? "max-xl:w-full" : "max-xl:w-0"}`}
            >
                <XIcon
                    className="xl:hidden absolute top-6 right-6 w-6 h-6 cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                />
                <Link onClick={handleNavClick} href="/movies">
                    Movies
                </Link>
                <Link onClick={handleNavClick} href="/favorites">
                    Favorites
                </Link>
                <Link onClick={handleNavClick} href="/theaters">
                    Theaters
                </Link>
                <Link onClick={handleNavClick} href="/releases">
                    Releases
                </Link>
                <div className="flex flex-col gap-3 xl:hidden">
                    {session?.session ? (
                        <>
                            <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-center">
                                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-red-900/80 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                                    {renderAvatar("h-full w-full bg-cover bg-center")}
                                </div>
                                <p className="text-base font-semibold text-white">{session.user.name}</p>
                                <p className="mt-1 text-sm text-white/60">user: {session.user.email}</p>
                            </div>
                            <Link
                                className="flex items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-2 text-center"
                                href="/account"
                                onClick={handleNavClick}
                            >
                                <Cog className="h-4 w-4" />
                                Manage Account
                            </Link>
                            <Link
                                className="flex items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-2 text-center"
                                href="/my-bookings"
                                onClick={handleNavClick}
                            >
                                <TicketPlus className="h-4 w-4" />
                                My Bookings
                            </Link>
                            <button
                                className="flex items-center justify-center gap-3 rounded-full bg-red-800 px-6 py-2 font-medium transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleSignOut}
                                disabled={isSigningOut || isPending}
                                type="button"
                            >
                                <LogOut className="h-4 w-4" />
                                {isSigningOut ? "Signing out..." : "Sign out"}
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                className="rounded-full border border-white/15 px-6 py-2 text-center"
                                href="/sign-in"
                                onClick={handleNavClick}
                            >
                                Sign in
                            </Link>
                            <Link
                                className="rounded-full bg-red-800 px-6 py-2 text-center font-medium"
                                href="/sign-up"
                                onClick={handleNavClick}
                            >
                                Sign up
                            </Link>
                        </>
                    )}
                </div>
            </div>
            <div className="hidden items-center gap-4 xl:flex">
                <SearchIcon className="w-6 h-6 cursor-pointer" />
                {session?.session ? (
                    <div
                        className="relative"
                        onMouseEnter={() => setIsAccountMenuOpen(true)}
                        onMouseLeave={() => setIsAccountMenuOpen(false)}
                        ref={accountMenuRef}
                    >
                        <button
                            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/30 hover:bg-white/10"
                            onClick={() => setIsAccountMenuOpen((current) => !current)}
                            type="button"
                        >
                            {renderAvatar("h-full w-full bg-cover bg-center")}
                        </button>

                        {isAccountMenuOpen ? (
                            <div className="absolute right-0 top-14 w-72 overflow-hidden rounded-3xl border border-white/10 bg-[#130909]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
                                <div className="px-5 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-red-900/80 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                                            {renderAvatar("h-full w-full bg-cover bg-center")}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-semibold text-white">
                                                {session.user.name}
                                            </p>
                                            <p className="mt-1 truncate text-sm text-white/60">
                                                user: {session.user.email}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-white/10" />

                                <Link
                                    className="flex items-center gap-3 px-5 py-4 text-sm text-white/85 transition hover:bg-white/5 hover:text-white"
                                    href="/account"
                                    onClick={handleNavClick}
                                >
                                    <Cog className="h-4 w-4" />
                                    Manage Account
                                </Link>

                                <div className="h-px bg-white/10" />

                                <Link
                                    className="flex items-center gap-3 px-5 py-4 text-sm text-white/85 transition hover:bg-white/5 hover:text-white"
                                    href="/my-bookings"
                                    onClick={handleNavClick}
                                >
                                    <TicketPlus className="h-4 w-4" />
                                    My Bookings
                                </Link>

                                <div className="h-px bg-white/10" />

                                <button
                                    className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm text-white/85 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={handleSignOut}
                                    disabled={isSigningOut || isPending}
                                    type="button"
                                >
                                    <LogOut className="h-4 w-4" />
                                    {isSigningOut ? "Signing out..." : "Sign out"}
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <Link
                            className="rounded-full border border-white/15 px-5 py-2 font-medium transition hover:border-white/30"
                            href="/sign-in"
                        >
                            Sign in
                        </Link>
                        <Link
                            className="rounded-full bg-red-800 px-5 py-2 font-medium transition hover:bg-red-700"
                            href="/sign-up"
                        >
                            Sign up
                        </Link>
                    </>
                )}
            </div>
            <div className="flex items-center gap-4 xl:hidden">
                <SearchIcon className="w-6 h-6 cursor-pointer" />
                <MenuIcon
                    className="w-8 h-8 cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                />
            </div>
    </nav>
    );
};

export default Navbar;