import { checkStore, parseUrls } from "@/lib/checker";

export async function POST(request: Request) {
  const { urls: rawUrls } = (await request.json()) as { urls: string[] };

  if (!rawUrls || !Array.isArray(rawUrls) || rawUrls.length === 0) {
    return Response.json({ error: "No URLs provided" }, { status: 400 });
  }

  const urls = rawUrls.flatMap((u) => parseUrls(u)).slice(0, 100);

  if (urls.length === 0) {
    return Response.json({ error: "No valid URLs found" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const CONCURRENCY = 5;

      for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const batch = urls.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(checkStore));

        for (const result of results) {
          controller.enqueue(
            encoder.encode(JSON.stringify(result) + "\n")
          );
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
