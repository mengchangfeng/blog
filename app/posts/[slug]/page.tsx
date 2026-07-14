import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "../../components/SiteNav";
import { getPost, getPosts } from "../../lib/posts";

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  return post ? { title: `${post.title} — Meng`, description: post.description } : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <div className="site-page">
      <SiteNav />
      <main className="page-wrap article-page">
        <Link className="back-link" href="/">← All writing</Link>
        <header className="article-header">
          <p className="kicker">{post.date}</p>
          <h1>{post.title}</h1>
          <div className="tag-list">{post.tags.map((tag) => <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`}>#{tag}</Link>)}</div>
        </header>
        <article className="markdown-body" dangerouslySetInnerHTML={{ __html: post.html }} />
      </main>
    </div>
  );
}
