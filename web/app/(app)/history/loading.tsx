import { Skeleton } from "@/components/Skeleton";
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-32" />
      <div className="flex gap-2"><Skeleton className="h-9 w-32 rounded-xl" /><Skeleton className="h-9 w-32 rounded-xl" /></div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
