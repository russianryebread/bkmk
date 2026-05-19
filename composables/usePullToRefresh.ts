import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

// Pull-to-refresh for a scrollable element. Records a touch start only when the
// element is scrolled to the top, tracks pull distance with resistance, and
// invokes `onRefresh` once the pull exceeds the threshold.
export function usePullToRefresh(
  scrollEl: Ref<HTMLElement | null>,
  onRefresh: () => Promise<unknown> | unknown,
) {
  const REFRESH_THRESHOLD = 70;

  const pullDistance = ref(0);
  const refreshing = ref(false);

  let startY = 0;
  let tracking = false;

  function onTouchStart(e: TouchEvent) {
    const el = scrollEl.value;
    if (!el || refreshing.value) return;
    if (el.scrollTop === 0 && e.touches[0]) {
      startY = e.touches[0].clientY;
      tracking = true;
    } else {
      tracking = false;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking || refreshing.value || !e.touches[0]) return;
    const delta = e.touches[0].clientY - startY;
    if (delta > 0) {
      // Apply resistance so the pull feels weighty.
      pullDistance.value = delta / 2;
    } else {
      pullDistance.value = 0;
    }
  }

  async function onTouchEnd() {
    if (!tracking) return;
    tracking = false;
    if (pullDistance.value >= REFRESH_THRESHOLD && !refreshing.value) {
      refreshing.value = true;
      pullDistance.value = 0;
      try {
        await onRefresh();
      } finally {
        refreshing.value = false;
      }
    } else {
      pullDistance.value = 0;
    }
  }

  onMounted(() => {
    if (typeof window === "undefined") return;
    const el = scrollEl.value;
    if (!el) return;
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
  });

  onBeforeUnmount(() => {
    if (typeof window === "undefined") return;
    const el = scrollEl.value;
    if (!el) return;
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("touchend", onTouchEnd);
  });

  return { refreshing, pullDistance };
}
