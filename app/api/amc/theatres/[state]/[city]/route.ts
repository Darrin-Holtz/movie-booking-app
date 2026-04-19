import { getAmcConfigError, getAmcTheatresByMarket, isAmcConfigured } from "@/lib/amc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ state: string; city: string }> }
) {
  if (!isAmcConfigured()) {
    return Response.json(
      {
        configured: false,
        error: getAmcConfigError(),
      },
      { status: 503 }
    );
  }

  const { state, city } = await params;
  const result = await getAmcTheatresByMarket(state, city);

  if (!result.ok) {
    return Response.json(
      {
        configured: true,
        state,
        city,
        error: result.error,
        details: result.details ?? [],
      },
      { status: result.status }
    );
  }

  return Response.json({
    configured: true,
    state,
    city,
    pageNumber: result.data.pageNumber,
    pageSize: result.data.pageSize,
    totalCount: result.data.totalCount,
    totalPages: result.data.totalPages,
    filteredLocally: result.data.filteredLocally,
    theatres: result.data.theatres,
  });
}