import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <main className="page-shell route-message" id="main-content"><p className="overline">404 · Page not found</p><h1 className="display-heading">There is no ticket here</h1><p>The address may be wrong, or the event may no longer be publicly listed.</p><Button asChild><Link href="/">Browse listed events</Link></Button></main>;
}
