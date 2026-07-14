import Link from "next/link";
import { SiteNav } from "../components/SiteNav";

export default function AboutPage() {
  return <div className="site-page"><SiteNav /><main className="page-wrap about-page"><p className="kicker">ABOUT</p><h1>你好，我是 Meng。</h1><p className="about-lede">记录技术、产品和日常思考。喜欢把复杂的事拆开，做成简单、可以被使用的东西。</p><p className="about-muted">这个博客使用 Markdown 维护，偶尔更新。</p><div className="about-links"><a href="mailto:hello@example.com">Email ↗</a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub ↗</a></div><Link className="back-link" href="/">← 返回文章</Link></main></div>;
}
