"use client";

import { useMutation, useQuery } from "convex/react";
import jsQR from "jsqr";
import {
  CameraIcon,
  CheckCircle2Icon,
  ImageIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import TicketPass from "@/components/TicketPass";
import { api } from "@/convex/_generated/api";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

type CameraState = "idle" | "starting" | "ready" | "unsupported" | "blocked" | "error";

const getBarcodeDetector = () => {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
};

const normalizeTicketLookupValue = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const pathMatch = parsedUrl.pathname.match(/\/tickets\/([^/?#]+)/i);

    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).toUpperCase();
    }
  } catch {
    const pathMatch = trimmedValue.match(/\/tickets\/([^/?#]+)/i);

    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).toUpperCase();
    }
  }

  return trimmedValue.toUpperCase();
};

export default function TicketScanPage() {
  const { data: session, isPending } = useAuthSession();
  const searchParams = useSearchParams();
  const [draftCode, setDraftCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [lastUsedAt, setLastUsedAt] = useState<number | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState("");
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const startCameraRef = useRef<() => Promise<void>>(async () => {});
  const scanTimerRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const markTicketUsed = useMutation(api.showSessions.markTicketUsed);
  const ticketScannerAccess = useQuery(
    api.userProfiles.getTicketScannerAccess,
    session?.session ? {} : "skip"
  );
  const ticket = useQuery(
    api.showSessions.getTicketScanPreview,
    session?.session && ticketScannerAccess?.isStaff && submittedCode
      ? { ticketCode: submittedCode }
      : "skip"
  );
  const ticketParam = searchParams.get("ticket") ?? "";
  const shouldAutoStartCamera = searchParams.get("camera") === "1";

  const stopCamera = (nextState: CameraState = "idle", nextError = "") => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    isDetectingRef.current = false;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    setCameraState(nextState);
    setCameraError(nextError);
  };

  useEffect(() => {
    return () => {
      if (scanTimerRef.current !== null) {
        window.clearInterval(scanTimerRef.current);
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      setCameraError("This device does not support camera scanning.");
      return;
    }

    const BarcodeDetector = getBarcodeDetector();

    if (!BarcodeDetector) {
      setCameraState("unsupported");
      setCameraError("This browser does not support live QR detection. Use the photo fallback or paste the ticket link or code instead.");
      return;
    }

    stopCamera("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      streamRef.current = stream;
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("ready");
      setCameraError("");

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current || isDetectingRef.current) {
          return;
        }

        if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }

        isDetectingRef.current = true;

        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          const rawValue = codes.find((code) => code.rawValue?.trim())?.rawValue;

          if (!rawValue) {
            return;
          }

          const normalizedCode = normalizeTicketLookupValue(rawValue);
          setDraftCode(normalizedCode);
          setSubmittedCode(normalizedCode);
          setLastUsedAt(null);
          toast.success("Ticket scanned.");
          stopCamera();
        } catch {
          // Ignore per-frame detection failures and keep scanning.
        } finally {
          isDetectingRef.current = false;
        }
      }, 700);
    } catch {
      stopCamera("blocked", "Camera access was blocked. You can still paste a code or link.");
    }
  };

  startCameraRef.current = startCamera;

  useEffect(() => {
    const normalizedTicket = normalizeTicketLookupValue(ticketParam);

    if (!normalizedTicket) {
      return;
    }

    setDraftCode((current) => (current === normalizedTicket ? current : normalizedTicket));
    setSubmittedCode((current) => (current === normalizedTicket ? current : normalizedTicket));
    setLastUsedAt(null);
  }, [ticketParam]);

  useEffect(() => {
    if (!shouldAutoStartCamera || !ticketScannerAccess?.isStaff || cameraState !== "idle") {
      return;
    }

    void startCameraRef.current();
  }, [cameraState, shouldAutoStartCamera, ticketScannerAccess?.isStaff]);

  if (isPending) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold text-white">Sign in to scan tickets.</h1>
          <Link href="/sign-in" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (ticketScannerAccess === undefined) {
    return <Loading />;
  }

  if (!ticketScannerAccess.isStaff) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
              <ShieldAlertIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Ticket Scan</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff access is required.</h1>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-white/65">
            {ticketScannerAccess.isConfigured
              ? `Signed in as ${ticketScannerAccess.email ?? "this account"}, but this email is not on the staff list.`
              : "No ticket staff has been set up yet. Open the staff dashboard and claim the first staff slot there."}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/staff"
              className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Open staff dashboard
            </Link>
            <Link
              href="/my-bookings"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              View bookings
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const decodeTicketPhoto = async (file: File) => {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Photo could not be opened."));
        nextImage.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Photo scanning is not available on this device.");
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (!qrResult?.data) {
        throw new Error("No QR code was found in that photo.");
      }

      return normalizeTicketLookupValue(qrResult.data);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsDecodingPhoto(true);

    try {
      const normalizedCode = await decodeTicketPhoto(file);
      setDraftCode(normalizedCode);
      setSubmittedCode(normalizedCode);
      setLastUsedAt(null);
      toast.success("Ticket found from photo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read that QR photo.");
    } finally {
      event.target.value = "";
      setIsDecodingPhoto(false);
    }
  };

  const handleLookup = () => {
    const normalizedCode = normalizeTicketLookupValue(draftCode);

    if (!normalizedCode) {
      toast.error("Enter a ticket code.");
      return;
    }

    setSubmittedCode(normalizedCode);
    setLastUsedAt(null);
  };

  const handleMarkUsed = async () => {
    if (!submittedCode) {
      return;
    }

    try {
      const result = await markTicketUsed({ ticketCode: submittedCode });

      if (result.status === "used") {
        setLastUsedAt(result.usedAt);
        toast("Ticket was already used.");
        return;
      }

      setLastUsedAt(result.usedAt);
      toast.success("Ticket marked as used.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to use ticket.");
    }
  };

  const effectiveUsedAt = lastUsedAt ?? ticket?.usedAt ?? null;
  const effectiveState = ticket?.status === "used" || effectiveUsedAt ? "used" : "active";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-4 pb-12 pt-28 text-white md:px-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700/30 text-emerald-200">
              <ShieldCheckIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Ticket Scan</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Check a ticket code.</h1>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-white/65">
            This is the check-in desk. Paste a ticket code or ticket link, use the camera, or upload a QR photo to see if a ticket is valid, already used, or not found.
          </p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Camera scan</p>
                <p className="mt-1 text-sm text-white/60">
                  Open the camera and point it at the ticket QR code.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraState === "starting" || cameraState === "ready"}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CameraIcon className="h-4 w-4" />
                  {cameraState === "starting"
                    ? "Starting camera"
                    : cameraState === "ready"
                      ? "Camera is on"
                      : "Open camera"}
                </button>
                <button
                  type="button"
                  onClick={() => stopCamera()}
                  disabled={cameraState !== "ready" && cameraState !== "starting"}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop camera
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isDecodingPhoto}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageIcon className="h-4 w-4" />
                  {isDecodingPhoto ? "Reading photo" : "Use photo instead"}
                </button>
              </div>
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelection}
            />

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            </div>

            {cameraError ? (
              <p className="mt-3 text-sm text-amber-200">{cameraError}</p>
            ) : cameraState === "ready" ? (
              <p className="mt-3 text-sm text-emerald-200">Camera is live. Hold the QR code inside the frame.</p>
            ) : (
              <p className="mt-3 text-sm text-white/45">If live scan is not available, take a photo of the QR code or paste the ticket link or code below.</p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
              <SearchIcon className="h-4 w-4 text-red-300" />
              <input
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                placeholder="Enter code like QS-7F4K9P2 or paste a ticket link"
                value={draftCode}
                onChange={(event) => setDraftCode(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={handleLookup}
              className="rounded-2xl bg-red-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Check ticket
            </button>
          </div>
        </section>

        {submittedCode ? (
          ticket === null ? (
            <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-100 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <XCircleIcon className="h-5 w-5" />
                <p className="text-base font-semibold">Ticket not found</p>
              </div>
              <p className="mt-3 text-sm text-red-100/80">No ticket matched {submittedCode}.</p>
            </section>
          ) : ticket ? (
            <section className="space-y-4">
              <div className={`rounded-3xl border p-5 shadow-xl shadow-black/20 ${
                effectiveState === "used"
                  ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                  : ticket.status === "not_confirmed"
                    ? "border-red-500/20 bg-red-500/10 text-red-100"
                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              }`}>
                <div className="flex items-center gap-3">
                  {effectiveState === "used" ? (
                    <XCircleIcon className="h-5 w-5" />
                  ) : (
                    <CheckCircle2Icon className="h-5 w-5" />
                  )}
                  <p className="text-base font-semibold">
                    {effectiveState === "used"
                      ? "Ticket already used"
                      : ticket.status === "not_confirmed"
                        ? "Ticket is not confirmed"
                        : "Ticket is valid"}
                  </p>
                </div>
                {effectiveUsedAt ? (
                  <p className="mt-3 text-sm">
                    Used at {new Date(effectiveUsedAt).toLocaleString("en-US")}
                  </p>
                ) : null}
              </div>

              <TicketPass
                movieTitle={ticket.movieTitle}
                theatreName={ticket.theatreName}
                theatreLocationLabel={ticket.theatreLocationLabel}
                auditoriumName={ticket.auditoriumName}
                date={ticket.date}
                time={ticket.time}
                seats={ticket.seats}
                ticketCode={ticket.ticketCode}
                state={effectiveState}
              />

              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleMarkUsed}
                  disabled={ticket.status !== "valid" || effectiveState === "used"}
                  className="rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark as used
                </button>
                <Link href={`/tickets/${ticket.ticketCode}`} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30">
                  Open ticket page
                </Link>
              </div>
            </section>
          ) : null
        ) : null}
      </div>
    </main>
  );
}