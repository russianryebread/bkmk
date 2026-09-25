<template>
  <div class="markdown-editor" :class="{ 'markdown-editor--compact': compact }">
    <pre ref="preview" class="markdown-editor__preview" aria-hidden="true" v-html="decoratedContent"></pre>
    <textarea
      ref="input"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :autofocus="autofocus"
      class="markdown-editor__input"
      spellcheck="true"
      @input="onInput"
      @keydown="onKeydown"
      @scroll="syncScroll"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { decorateMarkdown } from '~/utils/markdownEditor'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  ariaLabel?: string
  compact?: boolean
  autofocus?: boolean
}>(), {
  placeholder: 'Write your markdown here...',
  ariaLabel: 'Markdown editor',
  compact: false,
  autofocus: false,
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const input = ref<HTMLTextAreaElement | null>(null)
const preview = ref<HTMLElement | null>(null)
const decoratedContent = computed(() => decorateMarkdown(props.modelValue))

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function syncScroll() {
  if (!input.value || !preview.value) return
  preview.value.scrollTop = input.value.scrollTop
  preview.value.scrollLeft = input.value.scrollLeft
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return
  const el = input.value
  if (!el || el.selectionStart !== el.selectionEnd) return
  const before = el.value.slice(0, el.selectionStart)
  const line = before.slice(before.lastIndexOf('\n') + 1)
  const match = line.match(/^(\s*)([-*+]\s+|\d+[.)]\s+)(.*)$/)
  if (!match) return

  event.preventDefault()
  const [, indent, marker, text] = match
  const start = el.selectionStart
  if (!text.trim()) {
    // An empty list item ends the list on the next Return.
    const lineStart = before.lastIndexOf('\n') + 1
    el.setRangeText(`\n${indent}`, lineStart, start, 'end')
  } else {
    const nextMarker = /^\d/.test(marker) ? `${Number.parseInt(marker, 10) + 1}. ` : marker
    el.setRangeText(`\n${indent}${nextMarker}`, start, start, 'end')
  }
  emit('update:modelValue', el.value)
  nextTick(syncScroll)
}
</script>

<style scoped>
.markdown-editor {
  --editor-font-size: 14px;
  position: relative;
  min-height: 12rem;
  height: 100%;
  overflow: hidden;
  color: rgb(17 24 39);
}
.markdown-editor__preview,
.markdown-editor__input {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: inherit;
  margin: 0;
  padding: 1rem;
  border: 0;
  font: 400 var(--editor-font-size)/1.65 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: normal;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.markdown-editor__preview {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  color: inherit;
}
.markdown-editor__input {
  position: relative;
  display: block;
  resize: none;
  overflow: auto;
  background: transparent;
  color: transparent;
  caret-color: #111827;
  outline: none;
  -webkit-text-fill-color: transparent;
}
.markdown-editor__input::selection { background: rgb(59 130 246 / 28%); }
.markdown-editor__preview :deep(.md-heading) {
  display: inline-block;
  font-family: inherit;
  font-size: inherit;
  font-weight: 700;
  line-height: inherit;
  color: inherit;
  /* Enlarge visually without changing the text's layout width or line height;
     this keeps the transparent textarea's caret and selection aligned. */
  transform: scale(1.08);
  transform-origin: left center;
}
.markdown-editor__preview :deep(.md-strong) { font-weight: 700; }
.markdown-editor__preview :deep(.md-em) { font-style: italic; }
.markdown-editor__preview :deep(.md-list-marker) { color: #64748b; }
.markdown-editor__preview :deep(.md-marker) { opacity: .45; }
.markdown-editor--compact { min-height: 8rem; }
:global(.dark) .markdown-editor { color: rgb(243 244 246); }
:global(.dark) .markdown-editor__input { caret-color: #f3f4f6; }
</style>
