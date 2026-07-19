import type { Metadata } from "next";
import { CreateMarketForm } from "./CreateMarketForm";

export const metadata: Metadata = {
  title: "Create · HuskyMarkets",
};

export default function CreatePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <h1 className="text-3xl font-semibold text-text sm:text-4xl">
          New market
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Clear criteria, a public source, and no targeting private lives.
        </p>
      </div>
      <CreateMarketForm />
    </div>
  );
}
