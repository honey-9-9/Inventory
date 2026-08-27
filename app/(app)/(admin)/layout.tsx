import { requireAdmin } from "@/lib/auth";

/**
 * Route group guard for every admin-only page.
 *
 * A viewer who types /categories or /settings straight into the address bar is
 * redirected to their own dashboard here, before any admin UI is rendered or
 * any admin data is fetched.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
