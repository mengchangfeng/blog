import Link from "next/link";
import type { Post } from "../lib/posts";

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <div className="post-list">
      {posts.map((post) => (
        <article className="post-item" key={post.slug}>
          <time dateTime={post.date}>{post.date}</time>
          <div className="post-item-body">
            <h2><Link href={`/posts/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <div className="tag-list">
              {post.tags.map((tag) => <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`}>#{tag}</Link>)}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
