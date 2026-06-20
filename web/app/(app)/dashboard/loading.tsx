import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="glass rounded-3xl p-6 sm:col-span-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-10 w-48" />
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="mt-4 h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-32" />
      </div>
      <div className="glass rounded-3xl p-5">
        <Skeleton className="h-4 w-20" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <div className="glass rounded-3xl p-5 sm:col-span-2">
        <Skeleton className="h-4 w-24" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
