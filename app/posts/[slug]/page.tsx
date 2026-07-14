import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostHeader } from "../../components/PostHeader";
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

  return <div className="site-page"><SiteNav /><main className="page-wrap article-page"><PostHeader post={post} detail /><article className="markdown-body article-content" dangerouslySetInnerHTML={{ __html: post.html }} /></main></div>;
}
