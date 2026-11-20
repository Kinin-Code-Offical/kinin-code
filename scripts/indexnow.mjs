// Notifies IndexNow (Bing, Yandex, Seznam, Naver...) that kinin.dev pages
// changed, so they are recrawled within minutes. Bing's index also feeds
// ChatGPT Search and Microsoft Copilot.
//   node scripts/indexnow.mjs            -> submits every URL in the sitemap
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "kinin.dev";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyFile = readdirSync(path.join(root, "public")).find((name) =>
  /^indexnow-[0-9a-f]{32}\.txt$/.test(name),
);
if (!keyFile) {
  console.error("No public/indexnow-<key>.txt found");
  process.exit(1);
}
const key = keyFile.slice("indexnow-".length, -".txt".length);

const sitemap = await fetch(`https://${HOST}/sitemap.xml`).then((r) => r.text());
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
urlList.push(`https://${HOST}/llms.txt`);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${keyFile}`,
    urlList,
  }),
});
console.log(`IndexNow: HTTP ${response.status} for ${urlList.length} URLs`);
if (!response.ok && response.status !== 202) {
  console.log(await response.text());
  process.exit(1);
}
