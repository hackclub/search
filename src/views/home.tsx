import { Layout } from "./layout";

const endpoints = [
  {
    method: "GET",
    path: "/res/v1/web/search",
    title: "Web Search",
    description:
      "Search the web for pages, news, videos, discussions, and more.",
  },
  {
    method: "GET",
    path: "/res/v1/images/search",
    title: "Image Search",
    description: "Search for images across the web.",
  },
  {
    method: "GET",
    path: "/res/v1/videos/search",
    title: "Video Search",
    description: "Search for videos from YouTube, Vimeo, and more.",
  },
  {
    method: "GET",
    path: "/res/v1/news/search",
    title: "News Search",
    description: "Search for news articles from around the world.",
  },
  {
    method: "GET",
    path: "/res/v1/suggest/search",
    title: "Suggestions",
    description: "Get search query autocomplete suggestions.",
  },
];

export const Home = () => {
  return (
    <Layout title="Hack Club Search">
      <div class="text-center py-20 px-4 min-h-[80vh] flex flex-col justify-center items-center">
        <div class="mb-8 inline-block">
          <div class="w-20 h-20 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-bold text-4xl transform -rotate-6">
            🔍
          </div>
        </div>

        <h1 class="text-5xl md:text-7xl font-bold text-brand-heading mb-6 tracking-tight">
          Hack Club Search
        </h1>

        <p class="text-xl md:text-2xl text-brand-text mb-12 max-w-2xl mx-auto leading-relaxed">
          Brave Search API proxy for Hack Club members
        </p>

        <a
          href="/auth/login"
          class="inline-block bg-brand-primary text-white px-8 py-4 rounded-md text-lg font-bold hover:tracking-wider transition-all mb-20"
        >
          Sign in with Hack Club
        </a>

        <h2 class="text-3xl font-bold mb-10 text-brand-heading">
          Available Endpoints
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto mb-20">
          {endpoints.map((endpoint) => (
            <div class="bg-brand-surface border border-brand-border/50 rounded-lg p-6 text-left hover:border-brand-primary/30 transition-colors">
              <div class="flex items-center gap-2 mb-3">
                <span class="px-3 py-1 rounded text-xs font-bold tracking-wider bg-green-900/50 text-green-400 border border-green-700">
                  {endpoint.method}
                </span>
                <code class="text-xs font-mono text-brand-primary truncate">
                  {endpoint.path}
                </code>
              </div>
              <h3 class="text-xl font-bold text-brand-heading mb-2">
                {endpoint.title}
              </h3>
              <p class="text-brand-text text-sm">{endpoint.description}</p>
            </div>
          ))}
        </div>

        <p class="text-brand-text/60 font-medium">© 2025 Hack Club</p>
      </div>
    </Layout>
  );
};
