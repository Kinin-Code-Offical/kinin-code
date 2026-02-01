export async function GET() {
  return new Response("", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
