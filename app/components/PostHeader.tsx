import Link from "next/link";
import type { Post } from "../lib/posts";

export function PostHeader({ post, detail = false }: { post: Post; detail?: boolean }) {
  const Heading = detail ? "h1" : "h2";
  return (
    <div className={`post-item ${detail ? "post-item-detail" : ""}`}>
      <time dateTime={post.date}>{post.date}</time>
      <div className="post-item-body">
        <Heading>{detail ? post.title : <Link href={`/posts/${post.slug}`}>{post.title}</Link>}</Heading>
        <p>{post.description}</p>
        <div className="tag-list">{post.tags.map((tag) => <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`}>#{tag}</Link>)}</div>
      </div>
    </div>
  );
}
