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
        {/* Top 2 cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        {/* Bottom 2 cards with more detail */}
        <div className="grid gap-6 md:grid-cols-2">
            {/* Card for My Tasks list */}
            <div className="rounded-lg border bg-card p-6 space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="h-5 w-1/4" />
                        <Skeleton className="h-5 w-1/6" />
                    </div>
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-5 w-1/6" />
                    </div>
                     <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="h-5 w-1/4" />
                        <Skeleton className="h-5 w-1/6" />
                    </div>
                </div>
            </div>
             {/* Card for Recent Mentions */}
            <div className="rounded-lg border bg-card p-6 space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <div className="space-y-4 pt-2">
                    <div className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
