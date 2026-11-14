"use client";

import dynamic from "next/dynamic";

const ActivityFeed = dynamic(
  () =>
    import("./activity-feed").then((m) => ({
      default: m.ActivityFeed,
    })),
  { ssr: false, loading: () => null },
);

export function ActivityFeedLoader() {
  return <ActivityFeed />;
}
