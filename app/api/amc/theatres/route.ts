import { getAmcConfigError, getAmcTheatres, isAmcConfigured } from "@/lib/amc";

const parsePositiveInteger = (value: string | null, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function GET(request: Request) {
  if (!isAmcConfigured()) {
    return Response.json(
      {
        configured: false,
        error: getAmcConfigError(),
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pageNumber = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 100);
  const state = searchParams.get("state")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  const query =
    searchParams.get("query")?.trim() ??
    searchParams.get("q")?.trim() ??
    "";

  const result = await getAmcTheatres({
    pageNumber,
    pageSize,
    state,
    city,
    query,
  });

  if (!result.ok) {
    return Response.json(
      {
        configured: true,
        error: result.error,
        details: result.details ?? [],
      },
      { status: result.status }
    );
  }

  return Response.json({
    configured: true,
    filters: {
      state: state || null,
      city: city || null,
      query: query || null,
    },
    pageNumber: result.data.pageNumber,
    pageSize: result.data.pageSize,
    totalCount: result.data.totalCount,
    totalPages: result.data.totalPages,
    filteredLocally: result.data.filteredLocally,
    theatres: result.data.theatres,
  });
}