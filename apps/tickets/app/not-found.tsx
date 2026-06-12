import Link from 'next/link';

export default function NotFound() {
  return <main className="page-shell route-message" id="main-content"><p className="overline">404 · Page not found</p><h1 className="display-heading">There is no ticket here.</h1><p>The address may be wrong, or the event may no longer be publicly listed.</p><Link className="button button-primary" href="/">Browse listed events</Link></main>;
}
