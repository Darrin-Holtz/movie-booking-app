const AMC_REQUEST_TIMEOUT_MS = 8000;
const AMC_MAX_PAGE_SIZE = 100;
const AMC_MAX_PAGE_COUNT = 10;
const AMC_SEARCH_STOP_WORDS = new Set(["area", "theatre", "theatres", "theater", "theaters"]);

type AmcErrorItem = {
  id?: string;
  code?: number;
  exceptionMessage?: string;
  message?: string;
};

type AmcErrorResponse = {
  errors?: AmcErrorItem[];
};

const getAmcApiKey = () => process.env.AMC_API_KEY?.trim() ?? "";

const getAmcBaseUrl = () =>
  (process.env.AMC_API_BASE_URL?.trim() ?? "").replace(/\/+$/, "");

export const isAmcConfigured = () => {
  return Boolean(getAmcApiKey() && getAmcBaseUrl());
};

export const getAmcConfigError = () => {
  if (!getAmcApiKey()) {
    return "AMC_API_KEY is not set.";
  }

  if (!getAmcBaseUrl()) {
    return "AMC_API_BASE_URL is not set.";
  }

  return null;
};

type AmcRootResponse = {
  motd?: string;
  _links?: Record<string, unknown>;
};

type AmcFetchResult<T> =
  | {
      ok: true;
      status: number;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details?: AmcErrorItem[];
    };

export type AmcTheatre = {
  id?: number;
  code?: string;
  name?: string;
  longName?: string;
  slug?: string;
  city?: string;
  state?: string;
  address1?: string;
  address2?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    stateName?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type AmcTheatresResponse = {
  pageSize?: number;
  pageNumber?: number;
  count?: number;
  theatres?: AmcTheatre[];
  _links?: {
    self?: {
      href?: string;
      templated?: boolean;
    };
    next?: {
      href?: string;
      templated?: boolean;
    };
    [key: string]: unknown;
  };
  _embedded?: {
    theatres?: AmcTheatre[];
  };
  [key: string]: unknown;
};

export type AmcTheatresPage = {
  theatres: AmcTheatre[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  filteredLocally: boolean;
  raw: AmcTheatresResponse;
};

const clampPageNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
};

const clampPageSize = (value: number) => {
  if (!Number.isFinite(value)) {
    return AMC_MAX_PAGE_SIZE;
  }

  return Math.min(AMC_MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
};

const normalizeLocationToken = (value: unknown) => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

const normalizeSearchText = (value: unknown) => {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";
};

const getSearchTerms = (value: string | undefined) => {
  return normalizeSearchText(value)
    .split(/\s+/)
    .filter((term) => term.length > 0 && !AMC_SEARCH_STOP_WORDS.has(term));
};

const getTheatreCollection = (payload: AmcTheatresResponse) => {
  if (Array.isArray(payload.theatres)) {
    return payload.theatres;
  }

  if (Array.isArray(payload._embedded?.theatres)) {
    return payload._embedded.theatres;
  }

  return [];
};

const matchesTheatreLocation = (
  theatre: AmcTheatre,
  filters: { state?: string; city?: string; query?: string }
) => {
  const requestedState = normalizeLocationToken(filters.state);
  const requestedCity = normalizeLocationToken(filters.city);
  const requestedTerms = getSearchTerms(filters.query);

  const theatreStateValues = [
    theatre.state,
    theatre.location?.state,
    theatre.location?.stateName,
  ].map(normalizeLocationToken);

  const theatreCityValues = [
    theatre.city,
    theatre.location?.city,
  ].map(normalizeLocationToken);

  const stateMatches =
    !requestedState || theatreStateValues.some((value) => value === requestedState);
  const cityMatches =
    !requestedCity || theatreCityValues.some((value) => value === requestedCity);

  const searchableText = normalizeSearchText(
    [
      theatre.name,
      theatre.longName,
      theatre.slug,
      theatre.city,
      theatre.state,
      theatre.location?.city,
      theatre.location?.state,
      theatre.location?.stateName,
      theatre.location?.marketName,
      theatre.location?.addressLine1,
      theatre.location?.addressLine2,
      theatre.location?.postalCode,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
  );

  const queryMatches =
    requestedTerms.length === 0 ||
    requestedTerms.every((term) => searchableText.includes(term));

  return stateMatches && cityMatches && queryMatches;
};

async function getAmcTheatresPage(
  pageNumber: number,
  pageSize: number
): Promise<AmcFetchResult<AmcTheatresResponse>> {
  return fetchAmc<AmcTheatresResponse>("/v2/theatres", {
    searchParams: {
      "page-number": clampPageNumber(pageNumber),
      "page-size": clampPageSize(pageSize),
    },
  });
}

const buildAmcUrl = (
  path: string,
  searchParams: Record<string, string | number | boolean | undefined> = {}
) => {
  const baseUrl = getAmcBaseUrl();

  if (!baseUrl) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
};

export async function fetchAmc<T>(
  path: string,
  options: {
    searchParams?: Record<string, string | number | boolean | undefined>;
    revalidate?: number;
    init?: RequestInit;
  } = {}
): Promise<AmcFetchResult<T>> {
  const apiKey = getAmcApiKey();
  const url = buildAmcUrl(path, options.searchParams);

  if (!apiKey || !url) {
    return {
      ok: false,
      status: 503,
      error: getAmcConfigError() ?? "AMC API is not configured.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AMC_REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers(options.init?.headers);
    headers.set("Accept", "application/json");
    headers.set("X-AMC-Vendor-Key", apiKey);

    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
      ...options.init,
      headers,
      signal: controller.signal,
    };

    if (options.revalidate) {
      fetchOptions.next = { revalidate: options.revalidate };
    } else {
      fetchOptions.cache = "no-store";
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let error = `AMC request failed with status ${response.status}.`;
      let details: AmcErrorItem[] | undefined;

      try {
        const payload = (await response.json()) as AmcErrorResponse;
        if (Array.isArray(payload.errors) && payload.errors.length > 0) {
          details = payload.errors;
          error =
            payload.errors[0]?.message ??
            payload.errors[0]?.exceptionMessage ??
            error;
        }
      } catch {
        // Keep the fallback error message when the upstream payload is not JSON.
      }

      return {
        ok: false,
        status: response.status,
        error,
        details,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as T,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Failed to reach the AMC API.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchAmcJson<T>(
  path: string,
  options: {
    searchParams?: Record<string, string | number | boolean | undefined>;
    revalidate?: number;
    init?: RequestInit;
  } = {}
): Promise<T | null> {
  const result = await fetchAmc<T>(path, options);
  return result.ok ? result.data : null;
}

export async function getAmcStatus() {
  const data = await fetchAmcJson<AmcRootResponse>("/");

  if (!data) {
    return null;
  }

  return {
    motd: typeof data.motd === "string" ? data.motd : null,
    links:
      data._links && typeof data._links === "object"
        ? data._links
        : {},
  };
}

export async function getAmcTheatres(options: {
  pageNumber?: number;
  pageSize?: number;
  state?: string;
  city?: string;
  query?: string;
}) {
  const pageNumber = clampPageNumber(options.pageNumber ?? 1);
  const pageSize = clampPageSize(options.pageSize ?? AMC_MAX_PAGE_SIZE);
  const hasLocalFilters = Boolean(
    options.state?.trim() || options.city?.trim() || getSearchTerms(options.query).length > 0
  );

  if (!hasLocalFilters) {
    const result = await getAmcTheatresPage(pageNumber, pageSize);

    if (!result.ok) {
      return result;
    }

    const theatres = getTheatreCollection(result.data);
    const totalCount =
      typeof result.data.count === "number" && Number.isFinite(result.data.count)
        ? result.data.count
        : theatres.length;

    return {
      ok: true as const,
      status: result.status,
      data: {
        theatres,
        pageNumber,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        filteredLocally: false,
        raw: result.data,
      } satisfies AmcTheatresPage,
    };
  }

  const collectedTheatres: AmcTheatre[] = [];
  let currentPage = 1;
  let totalCount = 0;
  let lastRawPayload: AmcTheatresResponse = {};

  while (currentPage <= AMC_MAX_PAGE_COUNT) {
    const result = await getAmcTheatresPage(currentPage, AMC_MAX_PAGE_SIZE);

    if (!result.ok) {
      return result;
    }

    lastRawPayload = result.data;
    const theatres = getTheatreCollection(result.data);
    collectedTheatres.push(...theatres);

    totalCount =
      typeof result.data.count === "number" && Number.isFinite(result.data.count)
        ? result.data.count
        : collectedTheatres.length;

    const hasNextPage = Boolean(result.data._links?.next?.href);
    if (!hasNextPage || collectedTheatres.length >= totalCount) {
      break;
    }

    currentPage += 1;
  }

  const filteredTheatres = collectedTheatres.filter((theatre) =>
    matchesTheatreLocation(theatre, {
      state: options.state,
      city: options.city,
      query: options.query,
    })
  );

  const startIndex = (pageNumber - 1) * pageSize;
  const pagedTheatres = filteredTheatres.slice(startIndex, startIndex + pageSize);

  return {
    ok: true as const,
    status: 200,
    data: {
      theatres: pagedTheatres,
      pageNumber,
      pageSize,
      totalCount: filteredTheatres.length,
      totalPages: Math.max(1, Math.ceil(filteredTheatres.length / pageSize)),
      filteredLocally: true,
      raw: lastRawPayload,
    } satisfies AmcTheatresPage,
  };
}

export async function getAmcTheatresByMarket(state: string, city: string) {
  const result = await getAmcTheatres({
    state,
    city,
    query: city,
    pageNumber: 1,
    pageSize: AMC_MAX_PAGE_SIZE,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true as const,
    status: result.status,
    data: {
      theatres: result.data.theatres,
      pageNumber: result.data.pageNumber,
      pageSize: result.data.pageSize,
      totalCount: result.data.totalCount,
      totalPages: result.data.totalPages,
      filteredLocally: result.data.filteredLocally,
      raw: result.data,
    },
  };
}