import TheatresBrowse from "@/components/TheatresBrowse";
import { getAmcTheatres } from "@/lib/amc";

type PageSearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

const getSearchParam = (
  value: string | string[] | undefined,
  fallback: string
) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? fallback;
  }

  return fallback;
};

const TheatresPage = async ({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) => {
  const resolvedSearchParams = await searchParams;
  const query = getSearchParam(resolvedSearchParams.query, getSearchParam(resolvedSearchParams.q, ""));
  const state = getSearchParam(resolvedSearchParams.state, "");
  const city = getSearchParam(resolvedSearchParams.city, "");
  const result = await getAmcTheatres({
    pageNumber: 1,
    pageSize: 24,
    query,
    state,
    city,
  });

  return (
    <TheatresBrowse
      initialError={result.ok ? null : result.error}
      initialResults={
        result.ok
          ? {
              theatres: result.data.theatres,
              totalCount: result.data.totalCount,
              totalPages: result.data.totalPages,
              filteredLocally: result.data.filteredLocally,
            }
          : {
              theatres: [],
              totalCount: 0,
              totalPages: 1,
              filteredLocally: true,
            }
      }
      initialState={{
        query,
        state,
        city,
      }}
    />
  );
};

export default TheatresPage;