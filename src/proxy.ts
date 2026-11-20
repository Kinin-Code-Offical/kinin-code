import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SUPPORTED = ["tr", "en"] as const;
type SupportedLanguage = (typeof SUPPORTED)[number];

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return SUPPORTED.includes(value as SupportedLanguage);
}

function detectFromHeader(request: NextRequest): SupportedLanguage {
  const header = request.headers.get("accept-language") ?? "";
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("tr") ? "tr" : "en";
}

/**
 * Forwards the resolved language to server components via the request cookie
 * header, so the very first SSR render already matches what the client will
 * hydrate with (prevents hydration mismatches).
 */
function withLanguage(
  request: NextRequest,
  lang: SupportedLanguage,
  rewriteUrl?: URL,
) {
  const headers = new Headers(request.headers);
  const cookies = request.cookies
    .getAll()
    .filter((cookie) => cookie.name !== "lang")
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`);
  cookies.push(`lang=${lang}`);
  headers.set("cookie", cookies.join("; "));

  const response = rewriteUrl
    ? NextResponse.rewrite(rewriteUrl, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  if (request.cookies.get("lang")?.value !== lang) {
    response.cookies.set("lang", lang, COOKIE_OPTIONS);
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const match = pathname.match(/^\/(tr|en)(\/.*)?$/);
  if (match) {
    const lang = match[1] as SupportedLanguage;
    const rest = match[2] ?? "/";
    const url = request.nextUrl.clone();
    url.pathname = rest === "" ? "/" : rest;
    url.searchParams.set("lang", lang);
    return withLanguage(request, lang, url);
  }

  const paramLang = searchParams.get("lang");
  if (isSupported(paramLang)) {
    return withLanguage(request, paramLang);
  }

  const cookieLang = request.cookies.get("lang")?.value;
  if (isSupported(cookieLang)) {
    return NextResponse.next();
  }

  return withLanguage(request, detectFromHeader(request));
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|robots.txt|llms.txt|indexnow-|sitemap.xml|site.webmanifest|icon-192.png|icon-512.png|apple-icon.png|icon.png|og.png|og.svg|models/).*)",
  ],
};
