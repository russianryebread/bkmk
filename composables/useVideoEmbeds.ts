// Hydrates the inert video placeholders emitted by useMarkdown()'s video_embed
// rule into real players, on click.
//
// The placeholder is a plain <a> to the original video, so the pre-hydration
// and no-JS states are both useful. Clicking swaps in an <iframe> built here
// via the DOM API — the iframe is never part of the markdown HTML, so the
// sanitizer never has to allow iframes at all.
//
// Rendered content lands via v-html, so there is nothing for Vue to mount into.
// One delegated listener on the container handles every embed, including ones
// that appear after a re-render.

export function useVideoEmbeds(containerRef: Ref<HTMLElement | null>) {
  function play(container: HTMLElement) {
    const src = container.dataset.videoEmbed
    if (!src || container.dataset.videoPlaying === 'true') return

    const frame = document.createElement('iframe')
    frame.src = `${src}?autoplay=1`
    frame.title = container.dataset.videoTitle || 'Video player'
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    frame.setAttribute('allowfullscreen', '')
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    frame.className = 'video-embed__frame'

    container.dataset.videoPlaying = 'true'
    container.replaceChildren(frame)
  }

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    const container = target?.closest<HTMLElement>('[data-video-embed]')
    if (!container) return

    // Let modified clicks (open in new tab/window) fall through to the link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

    e.preventDefault()
    play(container)
  }

  // The reader container is behind a v-if (loading / edit mode), so it is
  // usually null at mount and can be swapped out later. Rebind on every change
  // rather than binding once.
  let bound: HTMLElement | null = null
  watch(
    containerRef,
    (el) => {
      bound?.removeEventListener('click', handleClick)
      bound = el ?? null
      bound?.addEventListener('click', handleClick)
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    bound?.removeEventListener('click', handleClick)
    bound = null
  })
}
