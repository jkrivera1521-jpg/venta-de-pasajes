import { DEFAULT_SCHEMA } from "../../../../../lib/rules";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(DEFAULT_SCHEMA);
}
