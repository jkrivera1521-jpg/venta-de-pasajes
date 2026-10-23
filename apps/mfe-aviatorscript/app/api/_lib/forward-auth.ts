export function upstreamJsonHeaders(request: Request) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  const correlationId = request.headers.get("x-correlation-id");
  if (correlationId) {
    headers.set("X-Correlation-Id", correlationId);
  }
  return headers;
}
