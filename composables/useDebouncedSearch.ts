// Pair of refs for a search input: the live `query` (bound to v-model) and a
// `debounced` value that lags behind by `delay` ms. Use `debounced` as the
// dependency for filter/computed work; bind `onInput` to the input's @input.
export function useDebouncedSearch(delay = 300) {
  const query = ref('')
  const debounced = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function onInput() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = query.value
    }, delay)
  }

  function reset() {
    if (timer) clearTimeout(timer)
    query.value = ''
    debounced.value = ''
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  return { query, debounced, onInput, reset }
}
