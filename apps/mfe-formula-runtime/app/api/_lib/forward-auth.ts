export function upstreamHeaders(request: Request) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const authorization = request.headers.get("authorization");
  const correlationId = request.headers.get("x-correlation-id");
  if (authorization) headers.set("Authorization", authorization);
  if (correlationId) headers.set("X-Correlation-Id", correlationId);
  return headers;
}
