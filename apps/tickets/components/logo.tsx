import Link from 'next/link';

export function Logo() {
  return <Link aria-label="Focaccia tickets home" className="brand" href="/">focaccia <span aria-hidden="true">/</span> tickets</Link>;
}
