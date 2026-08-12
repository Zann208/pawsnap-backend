import { useState, useEffect } from "react";
import { listenFollowCounts } from "../services/socialApi";

export function useUserCounters(uid) {
  const [c, setC] = useState({ followersCount: 0, followingCount: 0 });

  useEffect(() => {
    if (!uid) return;
    const unsub = listenFollowCounts(uid, (newCounts) => {
      setC((prev) => ({ ...prev, ...newCounts }));
    });
    return unsub;
  }, [uid]);
  return c;
}
