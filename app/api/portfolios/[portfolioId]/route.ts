import { api } from "@/lib/server/http";
import { portfolios } from "@/lib/server/portfolios";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ portfolioId: string }> };
export async function GET(_request: Request, context: Context) {
  return api(async () => portfolios().getPortfolio((await context.params).portfolioId));
}
