import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";

/** Branded 404 shown for any URL that does not match a page. */
export function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <img src="/logo.png" alt="Southern Reach Marketing" className="mx-auto h-16 w-auto" width={64} height={64} />
        <p className="mt-8 font-display text-6xl font-bold tracking-tight text-primary sm:text-7xl">404</p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">We couldn't find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be out of date, or the page may have moved. Check the address or head back to the hub.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign-in
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Search className="size-4" aria-hidden="true" />
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
