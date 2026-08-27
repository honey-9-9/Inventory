"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { History, LayoutDashboard, Menu, Package, Settings, Tags, X } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/categories", label: "Categories", icon: Tags, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Admin-only links are filtered out entirely for viewers. The matching route
  // layouts redirect too, so a typed-in URL does not get through either.
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin");

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            // Close the mobile drawer as we navigate, or it covers the new page.
            onClick={() => setMobileNavOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-soft hover:bg-canvas hover:text-ink",
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700"
      >
        {user.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{user.name}</p>
        <p className="truncate text-xs capitalize text-ink-soft">{user.role}</p>
      </div>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-3">
      <span aria-hidden className="text-2xl">
        🍪
      </span>
      <div>
        <p className="text-sm font-bold leading-tight text-ink">Drawer</p>
        <p className="text-xs leading-tight text-ink-soft">Inventory</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3 py-5 lg:flex">
        {brand}
        {nav}
        <div className="space-y-1">
          {identity}
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileNavOpen}
          className="cursor-pointer rounded-xl border border-line p-2 text-ink transition hover:bg-canvas"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="animate-slide-in absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-surface px-3 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="cursor-pointer rounded-xl p-2 text-ink-soft transition hover:bg-canvas hover:text-ink"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {nav}
            <div className="space-y-1">
              {identity}
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
