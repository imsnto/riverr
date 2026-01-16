import { Skeleton } from "@/components/ui/skeleton"

export function ContentSkeleton() {
  return (
    <div className="p-8 space-y-8">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
  )
}
