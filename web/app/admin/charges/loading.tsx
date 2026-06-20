import { Skeleton } from "@/components/Skeleton";
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
