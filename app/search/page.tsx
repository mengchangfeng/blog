import Link from "next/link";
import { PostList } from "../components/PostList";
import { SiteNav } from "../components/SiteNav";
import { getPosts } from "../lib/posts";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const tag = (params.tag ?? "").trim();
  const needle = query.toLowerCase();
  const results = getPosts().filter((post) => {
    const matchesTag = !tag || post.tags.some((item) => item.toLowerCase() === tag.toLowerCase());
    const haystack = `${post.title} ${post.description} ${post.content} ${post.tags.join(" ")}`.toLowerCase();
    return matchesTag && (!needle || haystack.includes(needle));
  });
  const heading = tag ? `#${tag}` : query ? `搜索：${query}` : "搜索文章";

  return (
    <div className="site-page">
      <SiteNav />
      <main className="page-wrap search-page">
        <div className="page-intro"><p className="kicker">SEARCH / FILTER</p><h1>{heading}</h1></div>
        <form className="search-form" action="/search"><input aria-label="搜索文章" name="q" defaultValue={query} placeholder="搜索标题、摘要或正文" /><button type="submit">Search →</button></form>
        {results.length ? <PostList posts={results} /> : <div className="empty-state">没有找到相关文章。<Link href="/">返回全部文章</Link></div>}
      </main>
    </div>
  );
}
