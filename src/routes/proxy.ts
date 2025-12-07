import * as Sentry from "@sentry/bun";
import { eq, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { etag } from "hono/etag";
import { HTTPException } from "hono/http-exception";
import { timeout } from "hono/timeout";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { rateLimiter } from "hono-rate-limiter";
import { db } from "../db";
import { requestLogs } from "../db/schema";
import { env } from "../env";
import { requireApiKey } from "../middleware/auth";
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

proxy.use(requireApiKey);

// ============================================================================
// ROUTES
// ============================================================================

proxy.get("/stats", standardLimiter, async (c) => {
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
proxy.get("/web/search", standardLimiter, async (c) => {
  const queryParams = c.req.query();
  return handleSearchRequest(c, "web", queryParams);
});

// Image Search
proxy.use("/images/search", etag());
proxy.get("/images/search", standardLimiter, async (c) => {
  const queryParams = c.req.query();
  return handleSearchRequest(c, "images", queryParams);
});

// Video Search
proxy.use("/videos/search", etag());
proxy.get("/videos/search", standardLimiter, async (c) => {
  const queryParams = c.req.query();
  return handleSearchRequest(c, "videos", queryParams);
});

// News Search
proxy.use("/news/search", etag());
proxy.get("/news/search", standardLimiter, async (c) => {
  const queryParams = c.req.query();
  return handleSearchRequest(c, "news", queryParams);
});

// Suggest
proxy.use("/suggest/search", etag());
proxy.get("/suggest/search", standardLimiter, async (c) => {
  const queryParams = c.req.query();
  return handleSearchRequest(c, "suggest", queryParams);
});

export default proxy;
