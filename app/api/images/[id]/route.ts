import { env } from "cloudflare:workers";

const bindings = env as unknown as { BUCKET: R2Bucket };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const object = await bindings.BUCKET.get(id);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!request.body) return Response.json({ error: "Image body is required" }, { status: 400 });
  await bindings.BUCKET.put(id, request.body, {
    httpMetadata: { contentType: request.headers.get("content-type") || "image/jpeg" },
  });
  return Response.json({ url: `/api/images/${id}` });
}
