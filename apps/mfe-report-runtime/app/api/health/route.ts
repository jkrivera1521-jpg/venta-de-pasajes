export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ service: "mfe-report-runtime", status: "ok", timestamp: new Date().toISOString() });
}
