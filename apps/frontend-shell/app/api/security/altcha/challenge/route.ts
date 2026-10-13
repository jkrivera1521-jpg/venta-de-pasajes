import { altcha, altchaNotConfiguredResponse, isAltchaConfigured } from "../../../_lib/altcha";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isAltchaConfigured()) {
    return altchaNotConfiguredResponse();
  }

  return altcha.challengeHandler(request);
}
