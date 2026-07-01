// Shared strict input validation for all public Edge Functions.
//
// Schema-light by design (no external dep) to match this codebase's existing
// hand-rolled Edge Function style. Every endpoint should: parse the body,
// reject unexpected top-level fields, then assert each expected field's
// type/format/length before touching the database or Stripe.

export class ValidationError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses the request body as JSON and ensures it is a plain object. */
export async function parseJsonObject(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

/** Rejects any top-level field not in `allowed` — closes the door on unexpected/extra fields. */
export function assertOnlyFields(body: Record<string, unknown>, allowed: string[]): void {
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length > 0) {
    throw new ValidationError(`Unexpected field(s): ${extra.join(", ")}`);
  }
}

export function assertUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new ValidationError(`${field} must be a valid UUID`);
  }
  return value;
}

export function assertString(
  value: unknown,
  field: string,
  opts: { maxLength?: number; minLength?: number } = {},
): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const minLength = opts.minLength ?? 1;
  if (value.length < minLength) {
    throw new ValidationError(`${field} must be at least ${minLength} character(s)`);
  }
  if (opts.maxLength && value.length > opts.maxLength) {
    throw new ValidationError(`${field} exceeds max length of ${opts.maxLength}`);
  }
  return value;
}

export function assertOptionalString(
  value: unknown,
  field: string,
  opts: { maxLength?: number } = {},
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return assertString(value, field, { ...opts, minLength: 0 });
}

/** Builds a uniform 400 response for a caught ValidationError (or any other parse failure). */
export function validationErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  const message = err instanceof ValidationError ? err.message : "Invalid request body";
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
