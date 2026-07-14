import Link from "next/link";

export function SiteNav() {
  return (
    <header className="site-nav">
      <div className="nav-wrap">
        <Link className="site-name" href="/">MCF<span>.</span></Link>
        <nav aria-label="主导航">
          <Link href="/">Writing</Link>
          <Link href="/about">About</Link>
        </nav>
        <form className="nav-search" action="/search">
          <label htmlFor="nav-search-input">搜索文章</label>
          <input id="nav-search-input" name="q" type="search" placeholder="Search" />
          <button aria-label="搜索" type="submit">⌕</button>
        </form>
      </div>
    </header>
  );
}
