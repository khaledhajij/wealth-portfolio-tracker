import { api, mutationBody } from "@/lib/server/http";
import { portfolios } from "@/lib/server/portfolios";
export const dynamic = "force-dynamic";
export async function GET() { return api(() => portfolios().listPortfolios()); }
export async function POST(request: Request) {
  return api(async () => portfolios().createPortfolio(await mutationBody(request)), 201);
}
