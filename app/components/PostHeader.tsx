import Link from "next/link";
import { PostViews } from "./PostViews";
import type { Post } from "../lib/posts";

export function PostHeader({ post, detail = false }: { post: Post; detail?: boolean }) {
  const Heading = detail ? "h1" : "h2";
  return (
    <div className={`post-item ${detail ? "post-item-detail" : ""}`}>
      <div className="post-item-body">
        <Heading>{detail ? post.title : <Link href={`/posts/${post.slug}`}>{post.title}</Link>}</Heading>
        <p>{post.description}</p>
        <div className="tag-list">{post.tags.map((tag) => <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`}>#{tag}</Link>)}</div>
        <div className="post-meta"><time dateTime={post.date}>{post.date}</time><PostViews slug={post.slug} record={detail} /></div>
      </div>
    </div>
  );
}
