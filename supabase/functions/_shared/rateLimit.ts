// Shared rate limiting helper for all public Edge Functions.
//
// Edge Functions are stateless across invocations/instances, so limits are
// enforced via the `rate_limits` table + `check_rate_limit` RPC (migration
// 025) rather than an in-memory counter. Every public endpoint should call
// `enforceRateLimit` before doing any real work.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Extracts the caller's IP from standard proxy headers, falling back to "unknown". */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
};

/**
 * Checks and records one call against the rate limit for `identifier`
 * (typically `ip:<ip>:<endpoint>` or `user:<userId>:<endpoint>`).
 *
 * Returns a 429 Response if the limit is exceeded, or null if the caller is
 * within budget and the request should proceed.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  { limit, windowSeconds }: RateLimitOptions,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
    p_key: identifier,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail open on infra errors — a rate-limit outage must not take down
    // the whole endpoint — but log loudly so it gets noticed.
    console.error("Rate limit check failed, allowing request:", error);
    return null;
  }

  if (!allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(windowSeconds) },
    });
  }

  return null;
}
