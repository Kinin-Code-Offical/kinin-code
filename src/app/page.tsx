import type { Metadata } from "next";
import { cookies } from "next/headers";
import HomeClient from "@/components/HomeClient";
import { getContent } from "@/lib/content";
import { profile } from "@/content/profile";
import { buildPageMetadata, resolveLanguage } from "@/lib/seo";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : undefined;
  const language = resolveLanguage(
    params?.lang ?? cookieStore.get("lang")?.value,
  );
  const title = `${profile.fullName} — ${profile.jobTitle[language]}`;
  const description = profile.description[language];
  const meta = buildPageMetadata({
    lang: language,
    path: "/",
    title,
    description,
  });
  return {
    ...meta,
    title: { absolute: title },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ dev?: string; debug?: string }>;
}) {
  const content = await getContent();
  const params = searchParams ? await searchParams : undefined;
  const debugEnabled =
    params?.dev === "1" ||
    params?.dev === "true" ||
    params?.debug === "1" ||
    params?.debug === "true";
  return <HomeClient content={content} debugEnabled={debugEnabled} />;
}
