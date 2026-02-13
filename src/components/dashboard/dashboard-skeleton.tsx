import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-20 flex-col items-center border-r bg-card p-4 gap-4">
        {/* Workspace Switcher */}
        <Skeleton className="h-12 w-12 rounded-lg" />

        <Skeleton className="h-px w-full" />

        {/* Navigation */}
        <div className="flex flex-col gap-4 flex-1 items-center">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>

        {/* User Profile */}
        <div className="flex flex-col gap-4 items-center w-full">
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 p-8 space-y-8">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
