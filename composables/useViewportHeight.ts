// Sync the `--dvh` CSS custom property with `window.innerHeight`. Used by
// detail pages whose layouts depend on the dynamic viewport height (so iOS
// address bar collapsing doesn't push controls off-screen).
export function useViewportHeight() {
  function setDvh() {
    document.documentElement.style.setProperty('--dvh', `${window.innerHeight}px`)
  }

  onMounted(() => {
    setDvh()
    window.addEventListener('resize', setDvh)
    window.addEventListener('orientationchange', setDvh)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', setDvh)
    window.removeEventListener('orientationchange', setDvh)
  })
}
