import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex flex-col gap-2 border-r bg-card p-2 w-64 transition-all">
        <div className="p-2 space-y-2">
             <Skeleton className="h-9 w-full" />
             <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex-1 space-y-1 p-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
           <Skeleton className="h-px w-full my-2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="mt-auto space-y-1 p-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-px w-full my-2" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
      {/* Content Skeleton */}
      <div className="flex-1 p-8 space-y-8">
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
    </div>
  )
}
