import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { postViews } from "../../../../db/schema";
import { getPost } from "../../../lib/posts";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };
const headers = { "Cache-Control": "no-store" };

async function count(context: Context, increment: boolean) {
  const { slug } = await context.params;
  if (!getPost(slug)) return Response.json({ error: "Article not found" }, { status: 404, headers });
  try {
    const db = getDb();
    const [row] = increment
      ? await db.insert(postViews).values({ slug, views: 1 }).onConflictDoUpdate({
          target: postViews.slug,
          set: { views: sql`${postViews.views} + 1` },
        }).returning({ views: postViews.views })
      : await db.select({ views: postViews.views }).from(postViews).where(eq(postViews.slug, slug));
    return Response.json({ views: row?.views ?? 0 }, { headers });
  } catch (error) {
    console.error("Article view counter unavailable", error);
    return Response.json({ error: "Counter unavailable" }, { status: 503, headers });
  }
}

export function GET(_request: Request, context: Context) {
  return count(context, false);
}

export function POST(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers });
  }
  return count(context, true);
}
