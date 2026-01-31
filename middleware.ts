import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SUPPORTED = ["tr", "en"] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const match = pathname.match(/^\/(tr|en)(\/.*)?$/);
  if (match) {
    const lang = match[1];
    const rest = match[2] ?? "/";
    const url = request.nextUrl.clone();
    url.pathname = rest === "" ? "/" : rest;
    url.searchParams.set("lang", lang);
    const response = NextResponse.rewrite(url);
    response.cookies.set("lang", lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  const langCookie = request.cookies.get("lang")?.value;
  if (!langCookie || !SUPPORTED.includes(langCookie as typeof SUPPORTED[number])) {
    const response = NextResponse.next();
    response.cookies.set("lang", "en", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|icon-192.png|icon-512.png|apple-icon.png|icon.png|og.png|og.svg).*)",
  ],
};
