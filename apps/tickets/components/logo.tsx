import Link from 'next/link';

import { Wordmark } from './brand';

export function Logo() {
  return (
    <Link aria-label="PrivatePass tickets home" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/">
      <Wordmark />
    </Link>
  );
}
