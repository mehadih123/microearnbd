interface CfPagesEnv {
  GEMINI_API_KEY?: string;
  GEMINIAPIKEY?: string;
  API_KEY?: string;
}

interface CfPagesContext {
  request: Request;
  env: CfPagesEnv;
}

export async function onRequestGet(context: CfPagesContext): Promise<Response> {
  const apiKey = (
    context.env.GEMINI_API_KEY ||
    context.env.GEMINIAPIKEY ||
    context.env.API_KEY ||
    ''
  ).trim();

  const configured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  const isVertexExpress = apiKey.startsWith('AQ.');

  return new Response(
    JSON.stringify({
      ok: true,
      service: 'microearnbd-support-api',
      runtime: 'cloudflare-pages',
      endpoint: isVertexExpress ? 'vertex-express' : 'gemini-api',
      model: isVertexExpress ? 'gemini-2.5-flash' : 'gemini-4-hydrogen',
      multimodal: true,
      configured,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
