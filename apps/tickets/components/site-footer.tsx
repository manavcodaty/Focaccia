import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div><strong>Focaccia tickets</strong><p>Free event tickets for the controlled EPQ deployment.</p></div>
        <nav aria-label="Footer navigation"><Link href="/">Discover</Link><Link href="/tickets">My tickets</Link><Link href="/privacy">Privacy</Link></nav>
      </div>
    </footer>
  );
}
