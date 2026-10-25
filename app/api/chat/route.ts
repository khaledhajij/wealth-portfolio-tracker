import { handleChat } from "@/lib/server/assistant";
import { portfolios } from "@/lib/server/portfolios";
import { api } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

export async function POST(request: Request) {
  try { return await handleChat(request, { service: portfolios() }); }
  catch (error) { return api(async () => { throw error; }); }
}
