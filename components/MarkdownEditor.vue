<template>
  <div
    ref="input"
    class="markdown-editor"
    :class="{ 'markdown-editor--compact': compact }"
    contenteditable="plaintext-only"
    role="textbox"
    aria-multiline="true"
    :aria-label="ariaLabel"
    :data-placeholder="placeholder"
    spellcheck="true"
    @input="onInput"
    @keydown="onKeydown"
    @paste="onPaste"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

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
const input = ref<HTMLDivElement | null>(null)

// Browsers represent Enter as DIV/BR nodes. Serialize those as markdown
// newlines, excluding the trailing BR used to keep an empty line editable.
function plainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  const children = Array.from(node.childNodes)
  if (children.length === 1 && children[0]?.nodeName === 'BR') return ''
  return children.map((child, index) => {
    if (child.nodeName === 'BR') return '\n'
    const block = child.nodeName === 'DIV' || child.nodeName === 'P'
    return (block && index > 0 ? '\n' : '') + plainText(child)
  }).join('')
}

function readContent() {
  return input.value ? plainText(input.value).replace(/\r\n/g, '\n') : ''
}

function onInput() {
  emit('update:modelValue', readContent())
}

function applyValue(value: string) {
  if (input.value && readContent() !== value) input.value.textContent = value
}

// Do not rewrite the editable DOM on a local keystroke: that would reset the
// browser's selection and undo history. Only apply actual external changes.
watch(() => props.modelValue, applyValue)
onMounted(() => {
  applyValue(props.modelValue)
  if (props.autofocus) input.value?.focus()
})

function insertText(text: string) {
  // Native editing retains the browser undo stack, unlike replacing innerHTML.
  document.execCommand('insertText', false, text)
  onInput()
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  insertText(event.clipboardData?.getData('text/plain') ?? '')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing || event.altKey || event.metaKey || event.ctrlKey) return
  const el = input.value
  const selection = window.getSelection()
  if (!el || !selection?.rangeCount) return
  const range = selection.getRangeAt(0)
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return

  event.preventDefault()
  const beforeRange = range.cloneRange()
  beforeRange.selectNodeContents(el)
  beforeRange.setEnd(range.startContainer, range.startOffset)
  const before = plainText(beforeRange.cloneContents())
  const line = before.slice(before.lastIndexOf('\n') + 1)
  const match = !event.shiftKey && range.collapsed && line.match(/^(\s*)([-*+]\s+|\d+[.)]\s+)(.*)$/)
  if (!match) {
    insertText('\n')
    return
  }

  const [, indent, marker, text] = match
  if (!text.trim()) {
    // Select the empty marker so Return ends the list.
    selection.modify('extend', 'backward', 'lineboundary')
    insertText(`\n${indent}`)
  } else {
    const nextMarker = /^\d/.test(marker) ? `${Number.parseInt(marker, 10) + 1}. ` : marker
    insertText(`\n${indent}${nextMarker}`)
  }
}
</script>

<style scoped>
.markdown-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: var(--markdown-editor-min-height, 12rem);
  padding: 1rem;
  overflow: auto;
  outline: none;
  color: rgb(17 24 39);
  font: 400 14px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.markdown-editor:empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}
.markdown-editor::selection { background: rgb(59 130 246 / 28%); }
.markdown-editor--compact { min-height: 8rem; }
:global(.dark) .markdown-editor { color: rgb(243 244 246); }
</style>
