import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-20 flex-col items-center border-r bg-card p-4 gap-4 justify-between">
        <div className="flex flex-col items-center gap-4 w-full">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-2 pt-4">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>

      {/* Content Skeleton */}
      <div className="p-8">
        <div className="grid grid-cols-2 gap-6 w-fit">
          
          <div className="col-span-2">
            <Skeleton className="h-8 w-48" />
          </div>
          
          <Skeleton className="h-40 w-52 rounded-xl" />
          <Skeleton className="h-40 w-52 rounded-xl" />

          {/* Left detailed card */}
          <div className="w-52 h-80 rounded-xl bg-card p-4 space-y-4 border">
             <Skeleton className="h-4 w-1/3" />
             <Skeleton className="h-4 w-2/3" />
              <div className="space-y-4 pt-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-8" />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-10" />
                </div>
                 <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-12" />
                </div>
              </div>
          </div>
          
          {/* Right detailed card */}
          <div className="w-52 h-80 rounded-xl bg-card p-4 space-y-4 border">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-full" />
              </div>
               <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-3/4" />
              </div>
               <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
