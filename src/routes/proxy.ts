import * as Sentry from "@sentry/bun";
import { eq, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { etag } from "hono/etag";
import { HTTPException } from "hono/http-exception";
import { timeout } from "hono/timeout";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  describeRoute,
  openAPIRouteHandler,
  resolver,
  validator,
} from "hono-openapi";
import { rateLimiter } from "hono-rate-limiter";
import { db } from "../db";
import { requestLogs } from "../db/schema";
import { env } from "../env";
import { requireApiKey } from "../middleware/auth";
import {
  ImageSearchQuerySchema,
  ImageSearchResponseSchema,
  NewsSearchQuerySchema,
  NewsSearchResponseSchema,
  StatsSchema,
  SuggestQuerySchema,
  SuggestResponseSchema,
  VideoSearchQuerySchema,
  VideoSearchResponseSchema,
  WebSearchQuerySchema,
  WebSearchResponseSchema,
} from "../openapi";
import type { AppVariables } from "../types";

// ============================================================================
// CONSTANTS
// ============================================================================

const BRAVE_API_BASE = "https://api.search.brave.com/res/v1";

const ENDPOINTS = {
  web: `${BRAVE_API_BASE}/web/search`,
  images: `${BRAVE_API_BASE}/images/search`,
  videos: `${BRAVE_API_BASE}/videos/search`,
  news: `${BRAVE_API_BASE}/news/search`,
  suggest: `${BRAVE_API_BASE}/suggest/search`,
} as const;

type EndpointType = keyof typeof ENDPOINTS;

// ============================================================================
// HELPERS (DRY)
// ============================================================================

function getBraveHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
  };
}

function buildSearchUrl(
  baseUrl: string,
  params: Record<string, unknown>,
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function getRequestHeaders(c: Context): Record<string, string> {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function validateQuery(q: string | undefined): void {
  if (!q || q.trim() === "") {
    throw new HTTPException(400, {
      message: "Query parameter 'q' is required",
    });
  }
  if (q.length > 400) {
    throw new HTTPException(400, {
      message: "Query exceeds 400 character limit",
    });
  }
}

async function logRequest(
  apiKeyId: string,
  userId: string,
  slackId: string,
  endpoint: EndpointType,
  request: Record<string, unknown>,
  response: unknown,
  headers: Record<string, string>,
  ip: string,
  duration: number,
): Promise<void> {
  Sentry.startSpan({ name: "db.insert.requestLog" }, async () => {
    await db
      .insert(requestLogs)
      .values({
        apiKeyId,
        userId,
        slackId,
        endpoint,
        request,
        response,
        headers,
        ip,
        timestamp: new Date(),
        duration,
      })
      .catch((err) => console.error("Logging error:", err));
  });
}

async function handleSearchRequest<T extends Record<string, unknown>>(
  c: Context<{ Variables: AppVariables }>,
  endpoint: EndpointType,
  queryParams: T,
): Promise<Response> {
  const apiKey = c.get("apiKey");
  const user = c.get("user");
  const startTime = Date.now();

  try {
    validateQuery(queryParams.q as string | undefined);

    const searchUrl = buildSearchUrl(ENDPOINTS[endpoint], queryParams);

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: getBraveHeaders(),
    });

    const responseData = await response.json();
    const duration = Date.now() - startTime;

    await logRequest(
      apiKey.id,
      user.id,
      user.slackId,
      endpoint,
      queryParams,
      responseData,
      getRequestHeaders(c),
      c.get("ip"),
      duration,
    );

    return c.json(responseData, response.status as ContentfulStatusCode);
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof HTTPException) {
      throw error;
    }

    console.error(`${endpoint} search proxy error:`, error);

    await logRequest(
      apiKey.id,
      user.id,
      user.slackId,
      endpoint,
      {},
      { error: error instanceof Error ? error.message : "Unknown error" },
      getRequestHeaders(c),
      c.get("ip"),
      duration,
    );

    throw new HTTPException(500, { message: "Internal server error" });
  }
}

// ============================================================================
// APP SETUP
// ============================================================================

const proxy = new Hono<{ Variables: AppVariables }>();

proxy.use(
  "*",
  bodyLimit({
    maxSize: 1 * 1024 * 1024,
    onError: () => {
      throw new HTTPException(413, { message: "Request too large" });
    },
  }),
  timeout(60000),
  (c, next) => {
    const cfIp = c.req.header("CF-Connecting-IP");
    if (!cfIp && env.NODE_ENV !== "development") {
      throw new HTTPException(400, {
        message:
          "Missing CF-Connecting-IP. This is a bug. Please contact support.",
      });
    }
    c.set("ip", cfIp || "127.0.0.1");
    return next();
  },
);

const limiterOpts = {
  limit: 100,
  windowMs: 30 * 60 * 1000,
  standardHeaders: "draft-6",
  keyGenerator: (c: Context<{ Variables: AppVariables }>) =>
    c.get("user")?.id || c.get("ip"),
} as const;
const standardLimiter = rateLimiter(limiterOpts);

proxy.use((c, next) => {
  if (c.req.path.endsWith("/openapi.json")) {
    return next();
  }
  return requireApiKey(c, next);
});

// ============================================================================
// ROUTE DESCRIPTIONS
// ============================================================================

const statsRoute = describeRoute({
  summary: "Get request statistics",
  description: "Get request statistics for your account.",
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Successful response.",
      content: { "application/json": { schema: resolver(StatsSchema) } },
    },
  },
});

const webSearchRoute = describeRoute({
  summary: "Web search",
  description:
    "Search the web using Brave Search API. Returns web results, news, videos, discussions, and more.",
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Successful response.",
      content: {
        "application/json": { schema: resolver(WebSearchResponseSchema) },
      },
    },
  },
});

const imageSearchRoute = describeRoute({
  summary: "Image search",
  description: "Search for images using Brave Search API.",
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Successful response.",
      content: {
        "application/json": { schema: resolver(ImageSearchResponseSchema) },
      },
    },
  },
});

const videoSearchRoute = describeRoute({
  summary: "Video search",
  description: "Search for videos using Brave Search API.",
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Successful response.",
      content: {
        "application/json": { schema: resolver(VideoSearchResponseSchema) },
      },
    },
  },
});

const newsSearchRoute = describeRoute({
  summary: "News search",
  description: "Search for news articles using Brave Search API.",
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Successful response.",
      content: {
        "application/json": { schema: resolver(NewsSearchResponseSchema) },
      },
    },
  },
});

const suggestRoute = describeRoute({
  summary: "Search suggestions",
  description: "Get search query suggestions using Brave Search API.",
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: "Successful response.",
      content: {
        "application/json": { schema: resolver(SuggestResponseSchema) },
      },
    },
  },
});

// ============================================================================
// ROUTES
// ============================================================================

proxy.get("/stats", statsRoute, standardLimiter, async (c) => {
  const user = c.get("user");

  const stats = await Sentry.startSpan(
    { name: "db.select.userStats" },
    async () => {
      return await db
        .select({
          totalRequests: sql<number>`COUNT(*)::int`,
        })
        .from(requestLogs)
        .where(eq(requestLogs.userId, user.id));
    },
  );

  return c.json(stats[0] || { totalRequests: 0 });
});

// Web Search
proxy.use("/web/search", etag());
proxy.get(
  "/web/search",
  webSearchRoute,
  validator("query", WebSearchQuerySchema),
  standardLimiter,
  async (c) => {
    const queryParams = c.req.valid("query");
    return handleSearchRequest(c, "web", queryParams);
  },
);

// Image Search
proxy.use("/images/search", etag());
proxy.get(
  "/images/search",
  imageSearchRoute,
  validator("query", ImageSearchQuerySchema),
  standardLimiter,
  async (c) => {
    const queryParams = c.req.valid("query");
    return handleSearchRequest(c, "images", queryParams);
  },
);

// Video Search
proxy.use("/videos/search", etag());
proxy.get(
  "/videos/search",
  videoSearchRoute,
  validator("query", VideoSearchQuerySchema),
  standardLimiter,
  async (c) => {
    const queryParams = c.req.valid("query");
    return handleSearchRequest(c, "videos", queryParams);
  },
);

// News Search
proxy.use("/news/search", etag());
proxy.get(
  "/news/search",
  newsSearchRoute,
  validator("query", NewsSearchQuerySchema),
  standardLimiter,
  async (c) => {
    const queryParams = c.req.valid("query");
    return handleSearchRequest(c, "news", queryParams);
  },
);

// Suggest
proxy.use("/suggest/search", etag());
proxy.get(
  "/suggest/search",
  suggestRoute,
  validator("query", SuggestQuerySchema),
  standardLimiter,
  async (c) => {
    const queryParams = c.req.valid("query");
    return handleSearchRequest(c, "suggest", queryParams);
  },
);

// OpenAPI
proxy.get(
  "/openapi.json",
  openAPIRouteHandler(proxy, {
    documentation: {
      info: {
        title: "Hack Club Search API",
        version: "1.0.0",
        description:
          "A Brave Search API proxy for Hack Club members. All endpoints require `Authorization: Bearer <token>`.",
      },
      servers: [
        {
          url: "https://search.hackclub.com/proxy/v1",
          description: "Production",
        },
      ],
      security: [{ Bearer: [] }],
      components: {
        securitySchemes: {
          Bearer: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
  }),
);

export default proxy;
