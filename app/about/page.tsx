import { notFound } from "next/navigation";
import { PostHeader } from "../components/PostHeader";
import { SiteNav } from "../components/SiteNav";
import { getPost } from "../lib/posts";

export default function AboutPage() {
  const post = getPost("about");
  if (!post) notFound();

  return <div className="site-page"><SiteNav /><main className="page-wrap article-page"><PostHeader post={post} detail /><article className="markdown-body article-content" dangerouslySetInnerHTML={{ __html: post.html }} /></main></div>;
}
