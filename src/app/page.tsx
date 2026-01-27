import HomeClient from "@/components/HomeClient";
import { getGithubProjects } from "@/lib/github";

export default async function Home() {
  const projects = await getGithubProjects();
  return <HomeClient projects={projects} />;
}
