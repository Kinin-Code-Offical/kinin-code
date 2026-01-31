import { profile } from "@/content/profile";

export async function GET() {
  const language = "en";

  const manifest = {
    name: profile.fullName,
    short_name: profile.fullName,
    description: profile.description[language],
    start_url: "/en",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#0b0f0e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
