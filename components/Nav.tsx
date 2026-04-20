'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',             label: 'Calendar' },
  { href: '/commitments',  label: 'Commitments' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-6">
      <span className="font-semibold text-gray-900 mr-4">Scheduler</span>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`text-sm font-medium ${
            pathname === href
              ? 'text-gray-900 border-b-2 border-gray-900 pb-0.5'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {label}
        </Link>
      ))}
      <div className="ml-auto text-xs text-gray-400">Press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono">K</kbd> to quick-add</div>
    </nav>
  )
}
