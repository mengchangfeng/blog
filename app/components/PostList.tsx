import type { Post } from "../lib/posts";
import { PostHeader } from "./PostHeader";

export function PostList({ posts }: { posts: Post[] }) {
  return <div className="post-list">{posts.map((post) => <PostHeader key={post.slug} post={post} />)}</div>;
}
