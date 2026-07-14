"use client";

import { useEffect, useMemo, useState } from "react";

type TimeMode = "dawn" | "day" | "dusk" | "night";

const posts = [
  {
    date: "2026.07.12",
    tag: "BUILD LOG",
    title: "把一个想法，做成可以被打开的东西",
    excerpt: "从一张草稿到一个能被使用的页面，中间真正重要的不是工具，而是不断缩小不确定性。",
    read: "6 min read",
  },
  {
    date: "2026.07.06",
    tag: "FIELD NOTE",
    title: "我如何给复杂问题画出第一张地图",
    excerpt: "当信息开始互相引用，先建立结构，再决定答案应该长什么样。",
    read: "8 min read",
  },
  {
    date: "2026.06.28",
    tag: "LIFE / TECH",
    title: "安静地做事，也是一种生产力",
    excerpt: "留一点没有通知、没有指标、没有即时反馈的时间，给真正需要发酵的工作。",
    read: "4 min read",
  },
];

const modeCopy: Record<TimeMode, { label: string; note: string }> = {
  dawn: { label: "DAWN MODE", note: "晨光渐亮，适合开始" },
  day: { label: "DAY MODE", note: "白昼进行中，保持专注" },
  dusk: { label: "DUSK MODE", note: "黄昏时分，适合回望" },
  night: { label: "NIGHT MODE", note: "夜色已深，慢一点也好" },
};

function getMode(hour: number): TimeMode {
  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const mode = useMemo(() => getMode(now.getHours()), [now]);
  const modeInfo = modeCopy[mode];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className={`site-shell mode-${mode}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="#top" aria-label="返回首页">
          <span className="brand-mark">/</span> MCF<span className="brand-dot">.</span>
        </a>
        <div className="nav-links">
          <a href="#writing">Writing</a>
          <a href="#projects">Projects</a>
          <a href="#about">About</a>
        </div>
        <a className="availability" href="mailto:hello@example.com">
          <span className="status-dot" /> Available for a good conversation
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> PERSONAL FIELD NOTES / 2026</p>
          <h1>把复杂的事，<br /><em>讲清楚。</em></h1>
          <p className="hero-intro">你好，我是 Meng。一名在产品、代码和真实世界之间来回走动的人。这里记录我正在学习、构建和思考的东西。</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#writing">阅读文章 <span>↘</span></a>
            <a className="text-link" href="#about">了解我 <span>→</span></a>
          </div>
        </div>
        <div className="hero-console" aria-label="当前时间状态">
          <div className="console-top"><span>LOCAL_CONTEXT</span><span>● LIVE</span></div>
          <div className="console-body">
            <span className="prompt">$</span><span>date --now</span>
            <strong>{now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</strong>
            <span className="prompt">$</span><span>theme --auto</span>
            <strong className="theme-output">{modeInfo.label}</strong>
            <p>// {modeInfo.note}</p>
          </div>
          <div className="console-footer">背景会随本地时间自动切换</div>
        </div>
      </section>

      <section className="section writing-section" id="writing">
        <div className="section-heading"><div><p className="eyebrow">01 / WRITING</p><h2>最近写了什么</h2></div><a className="text-link" href="#writing">View all notes <span>↗</span></a></div>
        <div className="post-list">
          {posts.map((post, index) => (
            <article className={`post-card ${index === 0 ? "featured" : ""}`} key={post.title}>
              <div className="post-index">0{index + 1}</div>
              <div className="post-main"><div className="post-meta"><span>{post.tag}</span><time>{post.date}</time></div><h3>{post.title}</h3><p>{post.excerpt}</p></div>
              <div className="post-read">{post.read}<span>↗</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section section" id="projects">
        <div className="section-heading compact"><div><p className="eyebrow">02 / PROJECTS</p><h2>正在做的事</h2></div></div>
        <div className="project-grid"><a className="project-card project-dark" href="#projects"><span className="project-no">01</span><div><p>KNOWLEDGE SYSTEM</p><h3>让知识<br />开始流动</h3></div><span className="project-arrow">↗</span></a><a className="project-card project-light" href="#projects"><span className="project-no">02</span><div><p>SMALL WEB THINGS</p><h3>小而有用的<br />互联网工具</h3></div><span className="project-arrow">↗</span></a></div>
      </section>

      <section className="about-section section" id="about"><div className="about-label"><p className="eyebrow">03 / ABOUT</p><span className="about-symbol">✳</span></div><div className="about-copy"><h2>保持好奇，<br /><em>保持在场。</em></h2><p>我相信好的工作应该同时拥有清晰的结构和人的温度。白天写代码、做产品，晚上读书、散步，偶尔把这些过程写下来。</p><a className="text-link" href="mailto:hello@example.com">Say hello <span>→</span></a></div></section>

      <footer className="footer"><span>© 2026 MENG CHANGFENG</span><span>BUILT WITH CURIOSITY <span className="footer-star">✳</span></span><a href="#top">BACK TO TOP ↑</a></footer>
    </main>
  );
}
