export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5",
    pubmed: true,
    openalex: true,
    openalexEnhanced: Boolean(process.env.OPENALEX_API_KEY),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    demoTokenRequired: Boolean(process.env.DEMO_ACCESS_TOKEN),
  });
}
