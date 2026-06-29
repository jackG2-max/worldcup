import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

interface NavProps {
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
}

const links = [
  { href: "/matches", label: "Matches" },
  { href: "/predictions", label: "My Predictions" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Nav({ fullName, email, isAdmin }: NavProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/matches" className="mr-2 text-base font-semibold tracking-tight">
          ⚽ Grey World Cup
        </Link>

        <div className="flex flex-1 flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-accent hover:bg-blue-50"
            >
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-500 sm:inline">
            {fullName || email}
          </span>
          <SignOutButton />
        </div>
      </nav>
    </header>
  );
}
