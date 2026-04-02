<script setup lang="ts">
// Import markdown directly as raw string (works on Vercel and dev)
import apiMdContent from '~/public/api.md?raw'
const content = computed(() => apiMdContent || '')

// Simple markdown to HTML conversion
const htmlContent = computed(() => {
    const text = content.value
    if (!text) return ''

    let html = text

    // STEP 1: Protect code blocks with placeholders (blocks with 3+ backticks)
    const codeBlocks: string[] = []
    html = html.replace(/```[\s\S]*?```/g, (match: string) => {
        const index = codeBlocks.length
        // Extract content between ``` markers
        const codeContent = match.slice(3, -3)
        const firstNewline = codeContent.indexOf('\n')
        const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent
        codeBlocks.push(`<pre class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto my-4 text-sm"><code class="text-gray-800 dark:text-gray-200 font-mono">${escapeHtml(code.trim())}</code></pre>`)
        return `__CODEBLOCK_${index}__`
    })

    // STEP 2: Protect inline code with placeholders
    const inlineCodeBlocks: string[] = []
    html = html.replace(/`[^`\n]+`/g, (match: string) => {
        const index = inlineCodeBlocks.length
        const codeContent = match.slice(1, -1)
        inlineCodeBlocks.push(codeContent)
        return `__INLINECODE_${index}__`
    })

    // STEP 3: Now process headers (safe - code blocks are protected)
    html = html.replace(/^#### (.+)$/gm, (_m: string, t: string) => {
        const id = t.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return `<h4 id="${id}" class="text-md font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100 scroll-mt-20">${t}</h4>`
    })
    html = html.replace(/^### (.+)$/gm, (_m: string, t: string) => {
        const id = t.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return `<h3 id="${id}" class="text-lg font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100 scroll-mt-20">${t}</h3>`
    })
    html = html.replace(/^## (.+)$/gm, (_m: string, t: string) => {
        const id = t.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return `<h2 id="${id}" class="text-xl font-semibold mt-8 mb-4 text-gray-900 dark:text-gray-100 scroll-mt-20">${t}</h2>`
    })
    html = html.replace(/^# (.+)$/gm, (_m: string, t: string) => {
        return `<h1 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 scroll-mt-20">${t}</h1>`
    })

    // STEP 4: Restore code blocks
    codeBlocks.forEach((block: string, index: number) => {
        html = html.replace(`__CODEBLOCK_${index}__`, block)
    })

    // STEP 5: Restore inline code
    inlineCodeBlocks.forEach((code: string, index: number) => {
        html = html.replace(`__INLINECODE_${index}__`, `<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-purple-600 dark:text-purple-400">${escapeHtml(code)}</code>`)
    })

    // STEP 6: Tables
    html = html.replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g, (_m: string, header: string, body: string) => {
        const headers = header.split('|').filter((h: string) => h.trim()).map((h: string) => h.trim())
        const rows = body.trim().split('\n').map((row: string) =>
            row.split('|').filter((c: string) => c.trim()).map((c: string) => c.trim())
        )

        let table = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">'
        table += '<thead><tr class="bg-gray-50 dark:bg-gray-800">'
        headers.forEach((h: string) => {
            table += `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${h}</th>`
        })
        table += '</tr></thead><tbody class="divide-y divide-gray-200 dark:divide-gray-700">'
        rows.forEach((row: string[]) => {
            table += '<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">'
            row.forEach((cell: string) => {
                table += `<td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${cell}</td>`
            })
            table += '</tr>'
        })
        table += '</tbody></table></div>'
        return table
    })

    // STEP 7: Lists
    html = html.replace(/^- \[x\] (.+)$/gm, '<li class="flex items-start gap-2 my-1"><span class="text-green-500 mt-1">✅</span><span>$1</span></li>')
    html = html.replace(/^- \[ \] (.+)$/gm, '<li class="flex items-start gap-2 my-1"><span class="text-gray-400 mt-1">🔲</span><span>$1</span></li>')
    html = html.replace(/^- (.+)$/gm, '<li class="my-1 ml-4 text-gray-700 dark:text-gray-300">$1</li>')

    // STEP 8: Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')

    // STEP 9: Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, text: string, url: string) => {
        try {
            if (url.startsWith('#') || url.startsWith('/')) {
                return `<a href="${url}" class="text-blue-600 dark:text-blue-400 hover:underline">${text}</a>`;
            }
            const parsed = new URL(url, location.origin);
            if (parsed.origin === location.origin) {
                return `<a href="${url}" class="text-blue-600 dark:text-blue-400 hover:underline">${text}</a>`;
            }
            return `<a href="${url}" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
        } catch (e) {
            return `<a href="${url}" class="text-blue-600 dark:text-blue-400 hover:underline">${text}</a>`;
        }
    });

    // STEP 10: Horizontal rules
    html = html.replace(/(^|\n)\s*---+\s*(?=\n|$)/g, '\n<hr/>\n');

    // STEP 11: Paragraphs
    html = html.replace(/\n\n/g, '</p><p class="my-4 text-gray-700 dark:text-gray-300">')
    html = '<p class="my-4 text-gray-700 dark:text-gray-300">' + html + '</p>'

    // Clean up
    html = html.replace(/<p class="my-4 text-gray-700 dark:text-gray-300"><\/p>/g, '')
    html = html.replace(/<p class="my-4 text-gray-700 dark:text-gray-300">(\s*<(?:h[1-6]|ul|ol|table|div|pre|blockquote))/g, '$1')
    html = html.replace(/(<\/(?:h[1-6]|ul|ol|table|div|pre|blockquote)>)\s*<\/p>/g, '$1')
    return html
})

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;')
}

// Table of contents from headings
const tableOfContents = computed(() => {
    const text = content.value
    if (!text) return []

    const headings: { id: string; text: string; level: number }[] = []
    const lines = text.split('\n')

    for (const line of lines) {
        const h2 = line.match(/^## (.+)$/)
        const h3 = line.match(/^### (.+)$/)

        if (h2 && h2[1]) {
            headings.push({
                id: h2[1].toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
                text: h2[1],
                level: 2
            })
        } else if (h3 && h3[1]) {
            headings.push({
                id: h3[1].toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
                text: h3[1],
                level: 3
            })
        }
    }

    return headings
})

useHead({
    title: 'API Documentation',
    meta: [
        { name: 'description', content: 'Bkmk API documentation for building extensions and third-party apps' }
    ]
})
</script>

<template>
    <h1 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">API Documentation</h1>
    <div class="min-h-screen bg-white dark:bg-gray-900">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="lg:grid lg:grid-cols-4 lg:gap-8">
                <!-- Table of Contents - Desktop -->
                <aside class="hidden lg:block col-span-1">
                    <nav class="sticky top-20 space-y-2">
                        <h3
                            class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                            On this page
                        </h3>
                        <ul class="space-y-2">
                            <li v-for="heading in tableOfContents" :key="heading.id">
                                <a :href="'#' + heading.id" :class="[
                                    'block text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors',
                                    heading.level === 2
                                        ? 'text-gray-700 dark:text-gray-300 font-medium'
                                        : 'text-gray-500 dark:text-gray-400 pl-4'
                                ]">
                                    {{ heading.text }}
                                </a>
                            </li>
                        </ul>
                    </nav>
                </aside>

                <!-- Main Content -->
                <div class="mt-0 lg:col-span-3">
                    <article class="prose prose-gray dark:prose-invert max-w-none" v-html="htmlContent" />
                </div>
            </div>
        </div>
    </div>
</template>
