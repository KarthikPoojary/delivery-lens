'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-1 h-11">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'text-neutral-100 bg-neutral-800'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            GitHub
          </Link>
          <Link
            href="/gerrit"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/gerrit'
                ? 'text-neutral-100 bg-neutral-800'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            Gerrit
          </Link>
        </div>
      </div>
    </nav>
  );
}
