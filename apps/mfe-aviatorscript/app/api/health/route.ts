export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    service: "mfe-aviatorscript",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
