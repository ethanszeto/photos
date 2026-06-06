/**
 * Limits concurrent thumbnail fetches so Safari and CDN/S3 don't get flooded (503s).
 * Visible cells enqueue with priority 0; lower numbers run first.
 */

type QueueEntry = {
  id: string;
  priority: number;
  grant: () => void;
  cancelled: boolean;
};

const DEFAULT_MAX_ACTIVE = 32;
const SCROLLING_MAX_ACTIVE = 12;

let maxActive = DEFAULT_MAX_ACTIVE;
let activeCount = 0;
const activeIds = new Set<string>();
const queue: QueueEntry[] = [];

function drain() {
  queue.sort((a, b) => a.priority - b.priority);

  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].cancelled) queue.splice(i, 1);
  }

  while (activeCount < maxActive && queue.length > 0) {
    const next = queue.shift()!;
    if (next.cancelled) continue;
    activeCount++;
    activeIds.add(next.id);
    next.grant();
  }
}

/** Lower budget while the user is actively scrolling (Safari fast-flick). */
export function setThumbnailLoadBudget(scrolling: boolean) {
  maxActive = scrolling ? SCROLLING_MAX_ACTIVE : DEFAULT_MAX_ACTIVE;
  drain();
}

/** Wait for a load slot. Returns cancel — call releaseThumbnailLoad after the image finishes. */
export function requestThumbnailLoad(id: string, priority: number, grant: () => void): () => void {
  const entry: QueueEntry = { id, priority, grant, cancelled: false };
  queue.push(entry);
  drain();

  return () => {
    entry.cancelled = true;
  };
}

export function releaseThumbnailLoad(id: string) {
  if (activeIds.delete(id)) {
    activeCount = Math.max(0, activeCount - 1);
    drain();
  }
}
