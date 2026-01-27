export type GithubProject = {
  name: string;
  description: string | null;
  url: string;
  updatedAt: string;
  language: string | null;
  stars: number;
};

const API_VERSION = "2022-11-28";
const REVALIDATE_SECONDS = 60 * 60;

export async function getGithubProjects(): Promise<GithubProject[]> {
  const username = process.env.GITHUB_USERNAME;

  if (!username) {
    return [];
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`,
      {
        headers,
        next: { revalidate: REVALIDATE_SECONDS },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return [];
    }

    const repos = (await response.json()) as Array<{
      name: string;
      description: string | null;
      html_url: string;
      updated_at: string;
      language: string | null;
      stargazers_count: number;
      fork: boolean;
      archived: boolean;
    }>;

    return repos
      .filter((repo) => !repo.fork && !repo.archived)
      .slice(0, 6)
      .map((repo) => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        updatedAt: repo.updated_at,
        language: repo.language,
        stars: repo.stargazers_count,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
