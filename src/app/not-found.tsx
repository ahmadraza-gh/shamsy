import Link from "next/link";
import { SearchX } from "lucide-react";

import { buttonClassName } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="page-frame grid min-h-screen place-items-center py-12">
      <div className="card w-full max-w-lg p-8 text-center">
        <SearchX className="mx-auto text-slate-400" size={38} />
        <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-slate-600">
          The page may have moved, or you may not have access to it.
        </p>
        <Link className={buttonClassName({ className: "mt-5" })} href="/">
          Return to the application
        </Link>
      </div>
    </main>
  );
}
