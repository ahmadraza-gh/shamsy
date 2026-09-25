"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui";

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="page-frame py-12">
      <div className="card grid min-h-80 place-items-center p-8 text-center">
        <div>
          <AlertTriangle className="mx-auto text-red-700" size={38} />
          <h1 className="mt-4 text-2xl font-semibold">This page could not be loaded</h1>
          <p className="mt-2 text-slate-600">Check the connection and try again. Your unsent order form is kept during normal request failures.</p>
          <Button className="mt-5" onClick={retry}><RotateCcw size={17} /> Try again</Button>
        </div>
      </div>
    </main>
  );
}
