import { api, mutationBody } from "@/lib/server/http";
import { portfolios } from "@/lib/server/portfolios";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ portfolioId: string }> };
export async function GET(_request: Request, context: Context) {
  return api(async () => portfolios().listPositions((await context.params).portfolioId));
}
export async function POST(request: Request, context: Context) {
  return api(async () => portfolios().addPosition((await context.params).portfolioId, await mutationBody(request)), 201);
}
