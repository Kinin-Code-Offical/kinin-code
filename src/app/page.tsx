import HomeClient from "@/components/HomeClient";
import { getContent } from "@/lib/content";

export default async function Home() {
  const content = await getContent();
  return <HomeClient content={content} />;
}
