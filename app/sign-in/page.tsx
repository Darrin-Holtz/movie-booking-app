"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth-client";
import { trackEvent } from "@/lib/analytics";

export default function SignInPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session?.session) {
      router.replace("/");
    }
  }, [router, session?.session]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);

    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/",
    });

    setIsSubmitting(false);

    if (result.error) {
      trackEvent("sign_in_error", {
        message: result.error.message || "Unable to sign in",
      });
      toast.error(result.error.message || "Unable to sign in");
      return;
    }

    trackEvent("sign_in_success");
    toast.success("Signed in");
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.28),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.35em] text-red-300/80">
            Welcome Back
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Sign in to book faster.
          </h1>
          <p className="mt-3 text-sm text-white/65">
            Access your bookings, saved favorites, and upcoming shows.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-white/75">Email</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/75">Password</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            <button
              className="w-full rounded-2xl bg-red-800 px-4 py-3 font-medium transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting || isPending}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-white/65">
            Need an account?{" "}
            <Link className="text-red-300 transition hover:text-red-200" href="/sign-up">
              Create one
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}