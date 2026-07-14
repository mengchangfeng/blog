import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export type Post = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  content: string;
  html: string;
};

const contentDir = path.join(process.cwd(), "content");

function readPost(filename: string): Post {
  const raw = fs.readFileSync(path.join(contentDir, filename), "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Invalid frontmatter in ${filename}`);
  const fields = Object.fromEntries(match[1].split("\n").map((line) => {
    const index = line.indexOf(":");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  const slug = filename.replace(/\.md$/, "");
  const description = fields.description?.replace(/^['"]|['"]$/g, "") ?? "";
  const tags = (fields.tags ?? "").replace(/[\[\]]/g, "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const content = match[2].trim();
  return { slug, title: fields.title ?? slug, date: fields.date ?? "", description, tags, content, html: marked.parse(content) as string };
}

export function getPosts(): Post[] {
  return fs.readdirSync(contentDir).filter((file) => file.endsWith(".md")).map(readPost).sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((post) => post.slug === slug);
}
