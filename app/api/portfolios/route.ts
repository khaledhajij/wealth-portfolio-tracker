import { api } from "@/lib/server/http";
import { portfolios } from "@/lib/server/portfolios";
export const dynamic = "force-dynamic";
export async function GET() { return api(() => portfolios().listPortfolios()); }
