import { Cog } from "lucide-react";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
            <Cog className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Account</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Manage your profile.</h1>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-white/65">
          This page is ready for profile details, password updates, notification settings, and connected auth providers.
        </p>
      </div>
    </main>
  );
}