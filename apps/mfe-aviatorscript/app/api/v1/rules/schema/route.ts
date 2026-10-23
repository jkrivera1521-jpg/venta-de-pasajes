import { CANONICAL_AVIATOR_SCHEMA } from "../../../../../lib/aviator-contract";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(CANONICAL_AVIATOR_SCHEMA);
}
