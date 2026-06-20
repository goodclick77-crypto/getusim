import { Skeleton } from "@/components/Skeleton";
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="glass rounded-2xl p-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
