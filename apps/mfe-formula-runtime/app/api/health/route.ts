export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ service: "mfe-formula-runtime", status: "ok", timestamp: new Date().toISOString() });
}
