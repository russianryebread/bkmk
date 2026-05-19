// Minimal ambient declaration for jsdom while @types/jsdom is being installed.
// Once `bun install` runs and pulls in @types/jsdom from devDependencies, this
// file can be deleted.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: Record<string, unknown>)
    window: any
  }
}
