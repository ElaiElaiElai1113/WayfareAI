import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";

export function ItinerarySkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>

      {/* Days skeleton */}
      {Array.from({ length: 3 }).map((_, dayIndex) => (
        <Card key={dayIndex} className="p-4 space-y-3">
          <Skeleton className="h-8 w-32" />

          {/* Stops skeleton */}
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, stopIndex) => (
              <div key={stopIndex} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl" />
      ))}
      <div className="md:col-span-3">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <Card className="h-[520px] p-2">
      <Skeleton className="h-full w-full rounded-xl" />
    </Card>
  );
}
