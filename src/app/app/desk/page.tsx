import { Suspense } from "react";
import Desk from "@/components/Desk";
import { StateBlock } from "@/components/ui";

export default function DeskPage() {
  return (
    <Suspense
      fallback={
        <StateBlock kind="loading" title="Loading desk…" />
      }
    >
      <Desk />
    </Suspense>
  );
}
