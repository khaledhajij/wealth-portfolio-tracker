import { api, mutationBody } from "@/lib/server/http";
import { portfolios } from "@/lib/server/portfolios";
type Context = { params: Promise<{ portfolioId: string }> };
export async function POST(request: Request, context: Context) {
  return api(async () => portfolios().addPosition((await context.params).portfolioId, await mutationBody(request)));
}
