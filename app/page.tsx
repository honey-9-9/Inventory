import { redirect } from "next/navigation";

/**
 * The app has no marketing page - the root just sends you where you belong.
 * The middleware bounces unauthenticated visitors to /login before this runs.
 */
export default function HomePage() {
  redirect("/dashboard");
}
