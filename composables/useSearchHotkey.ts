// Press `/` (outside any text field) to focus a search input. Pass the input
// ref returned from a template ref.
export function useSearchHotkey(inputRef: Ref<HTMLInputElement | null>) {
  function handler(e: KeyboardEvent) {
    if (e.key !== '/') return
    const active = document.activeElement?.tagName
    if (active === 'INPUT' || active === 'TEXTAREA') return
    e.preventDefault()
    inputRef.value?.focus()
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
}
