import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p>Focaccia tickets. Free checkout for the controlled EPQ deployment.</p>
        <div><Link href="/privacy">Privacy</Link><span aria-hidden="true">·</span><Link href="/">Events</Link></div>
      </div>
    </footer>
  );
}
