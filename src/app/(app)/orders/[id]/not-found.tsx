import Link from "next/link";
import { SearchX } from "lucide-react";

import { buttonClassName } from "@/components/ui";

export default function OrderNotFound() {
  return (
    <main className="page-frame py-12">
      <div className="card grid min-h-80 place-items-center p-8 text-center">
        <div>
          <SearchX className="mx-auto text-slate-400" size={38} />
          <h1 className="mt-4 text-2xl font-semibold">Order not found</h1>
          <p className="mt-2 text-slate-600">It may not exist, or you may not have access to it.</p>
          <Link className={buttonClassName({ className: "mt-5" })} href="/orders">Back to orders</Link>
        </div>
      </div>
    </main>
  );
}
