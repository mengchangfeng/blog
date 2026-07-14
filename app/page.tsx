import Link from "next/link";
import { PostList } from "./components/PostList";
import { SiteNav } from "./components/SiteNav";
import { getPosts } from "./lib/posts";

export default function Home() {
  const posts = getPosts();

  return (
    <div className="site-page">
      <SiteNav />
      <main className="page-wrap home-page">
        <div className="page-intro">
          <p className="kicker">WRITING / ALL NOTES</p>
          <h1>文章</h1>
        </div>
        <PostList posts={posts} />
      </main>
      <footer className="site-footer"><span>© 2026 Meng</span><Link href="/about">About</Link></footer>
    </div>
  );
}
