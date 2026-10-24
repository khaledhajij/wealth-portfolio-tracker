import { api, mutationBody } from "@/lib/server/http";
import { portfolios } from "@/lib/server/portfolios";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ portfolioId: string; positionId: string }> };
export async function GET(_request: Request, context: Context) {
  return api(async () => {
    const { portfolioId, positionId } = await context.params;
    return portfolios().getPosition(portfolioId, positionId);
  });
}
export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    const { portfolioId, positionId } = await context.params;
    return portfolios().updatePrice(portfolioId, positionId, await mutationBody(request));
  });
}
