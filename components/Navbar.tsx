"use client";

import { useQuery } from "convex/react";
import { ArrowRightIcon, Cog, HeartIcon, LogOut, MenuIcon, TicketPlus, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/convex/_generated/api";
import { useAuthSession } from "@/components/AuthSessionProvider";
import { authClient } from "@/lib/auth-client";

const Navbar = () => {
    const router = useRouter();
    const { data: session, isPending } = useAuthSession();
    const favorites = useQuery(
        api.favorites.getMyFavorites,
        session?.session ? {} : "skip"
    ) as Array<{ _id: string }> | undefined;
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement | null>(null);
    const accountMenuCloseTimeoutRef = useRef<number | null>(null);
    const favoriteCount = favorites?.length ?? 0;

    const renderFavoriteBadge = () => {
        if (!session?.session || favoriteCount === 0) {
            return null;
        }

        return (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-800 px-2 py-0.5 text-xs font-semibold text-white">
                {favoriteCount}
            </span>
        );
    };

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
            if (accountMenuCloseTimeoutRef.current !== null) {
                window.clearTimeout(accountMenuCloseTimeoutRef.current);
            }

            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = "";
            return;
        }

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

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

    const handleAccountMenuOpen = () => {
        if (accountMenuCloseTimeoutRef.current !== null) {
            window.clearTimeout(accountMenuCloseTimeoutRef.current);
            accountMenuCloseTimeoutRef.current = null;
        }

        setIsAccountMenuOpen(true);
    };

    const handleAccountMenuClose = () => {
        if (accountMenuCloseTimeoutRef.current !== null) {
            window.clearTimeout(accountMenuCloseTimeoutRef.current);
        }

        accountMenuCloseTimeoutRef.current = window.setTimeout(() => {
            setIsAccountMenuOpen(false);
            accountMenuCloseTimeoutRef.current = null;
        }, 180);
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
        <nav className="fixed top-0 left-0 z-50 w-full px-6 py-5 md:px-16 lg:px-28 xl:px-36">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-white/10 bg-black/45 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-xl md:px-6">
                <Link href="/" className="min-w-0 flex-1 xl:flex-none">
                    <div className="text-3xl font-bold leading-none">
                        Quick<span className="text-red-800">Show</span>
                    </div>
                </Link>

                <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
                    <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-center text-xs font-medium uppercase tracking-[0.28em] text-white/65">
                        Book tickets. Save favorites. Track holds.
                    </div>
                </div>

                <div className="hidden items-center gap-4 xl:flex">
                    <Link
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10"
                        href="/movies"
                        onClick={handleNavClick}
                    >
                        Browse Movies
                        <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
                    </Link>

                    {session?.session ? (
                        <div
                            className="relative"
                            onMouseEnter={handleAccountMenuOpen}
                            onMouseLeave={handleAccountMenuClose}
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
                                <div className="absolute right-0 top-12 w-72 pt-3">
                                    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#130909]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
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

                                        <Link
                                            className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-white/85 transition hover:bg-white/5 hover:text-white"
                                            href="/favorite"
                                            onClick={handleNavClick}
                                        >
                                            <span className="flex items-center gap-3">
                                                <HeartIcon className="h-4 w-4" />
                                                Favorites
                                            </span>
                                            {renderFavoriteBadge()}
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
                    <MenuIcon
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => setIsOpen(!isOpen)}
                    />
                </div>
            </div>

            {isOpen ? (
                <div className="fixed inset-0 z-60 xl:hidden">
                    <button
                        aria-label="Close menu backdrop"
                        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_35%),rgba(3,3,3,0.88)] backdrop-blur-md"
                        onClick={() => setIsOpen(false)}
                        type="button"
                    />

                    <div className="absolute inset-x-4 top-4 rounded-4xl border border-white/10 bg-[#090909]/96 p-5 shadow-2xl shadow-black/50">
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.3em] text-red-300/80">
                                    QuickShow
                                </p>
                                <p className="mt-2 max-w-xs text-sm text-white/60">
                                    Book tickets fast, keep your favorites personal, and manage your holds in one place.
                                </p>
                            </div>
                            <button
                                className="rounded-full border border-white/10 p-2 text-white transition hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                                type="button"
                                aria-label="Close menu"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-5 flex flex-col gap-3">
                            <Link
                                className="flex items-center justify-center gap-3 rounded-full bg-red-800 px-6 py-3 text-center font-medium transition hover:bg-red-700"
                                href="/movies"
                                onClick={handleNavClick}
                            >
                                Browse Movies
                                <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
                            </Link>

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
                                        className="flex items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-3 text-center"
                                        href="/account"
                                        onClick={handleNavClick}
                                    >
                                        <Cog className="h-4 w-4" />
                                        Manage Account
                                    </Link>
                                    <Link
                                        className="flex items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-3 text-center"
                                        href="/my-bookings"
                                        onClick={handleNavClick}
                                    >
                                        <TicketPlus className="h-4 w-4" />
                                        My Bookings
                                    </Link>
                                    <Link
                                        className="flex items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-3 text-center"
                                        href="/favorite"
                                        onClick={handleNavClick}
                                    >
                                        <HeartIcon className="h-4 w-4" />
                                        Favorites
                                        {renderFavoriteBadge()}
                                    </Link>
                                    <button
                                        className="flex items-center justify-center gap-3 rounded-full bg-red-800 px-6 py-3 font-medium transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                                        className="rounded-full border border-white/15 px-6 py-3 text-center"
                                        href="/sign-in"
                                        onClick={handleNavClick}
                                    >
                                        Sign in
                                    </Link>
                                    <Link
                                        className="rounded-full bg-red-800 px-6 py-3 text-center font-medium"
                                        href="/sign-up"
                                        onClick={handleNavClick}
                                    >
                                        Sign up
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </nav>
    );
};

export default Navbar;