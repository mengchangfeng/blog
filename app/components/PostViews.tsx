"use client";

import { useEffect, useRef, useState } from "react";

export function PostViews({ slug, record = false }: { slug: string; record?: boolean }) {
  const [views, setViews] = useState<{ key: string; count: number } | null>(null);
  const pending = useRef<{ key: string; result: Promise<number> } | null>(null);

  useEffect(() => {
    let active = true;
    const key = `${slug}:${record}`;
    // Reuse the request when React replays an effect in development.
    if (pending.current?.key !== key) {
      pending.current = {
        key,
        result: fetch(`/api/views/${encodeURIComponent(slug)}`, {
          method: record ? "POST" : "GET",
          cache: "no-store",
        }).then(async (response) => {
          if (!response.ok) throw new Error("Counter unavailable");
          const data = await response.json();
          if (!Number.isSafeInteger(data.views) || data.views < 0) throw new Error("Invalid count");
          return data.views as number;
        }),
      };
    }
    pending.current.result.then((value) => {
      if (active) setViews({ key, count: value });
    }).catch(() => { /* Keep the article readable if the counter is unavailable. */ });
    return () => { active = false; };
  }, [slug, record]);

  return <span className="post-views">{views?.key === `${slug}:${record}` ? views.count.toLocaleString("zh-CN") : "—"} 次点击</span>;
}
