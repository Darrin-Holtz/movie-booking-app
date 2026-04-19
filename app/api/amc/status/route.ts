import { getAmcConfigError, getAmcStatus, isAmcConfigured } from "@/lib/amc";

export async function GET() {
  if (!isAmcConfigured()) {
    return Response.json(
      {
        configured: false,
        error: getAmcConfigError(),
      },
      { status: 503 }
    );
  }

  const status = await getAmcStatus();

  if (!status) {
    return Response.json(
      {
        configured: true,
        connected: false,
        error: "Failed to reach the AMC API.",
      },
      { status: 502 }
    );
  }

  return Response.json({
    configured: true,
    connected: true,
    ...status,
  });
}