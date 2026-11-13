import { build, type Plugin } from 'vite'

const SUFFIX = '?worklet'
const PREFIX = '\0worklet:'

/**
 * `import code from './processor.ts?worklet'` gives that file, bundled with
 * everything it imports into one self-contained script, as a string. The
 * caller turns the string into a Blob and hands it to `audioWorklet.addModule`.
 *
 * Why not Vite's own `?worker&url`: Tone's audio layer does not pass a worklet
 * URL to the browser. It fetches the source text, wraps it in a function and
 * loads the result. A dev-server module, with its imports, does not survive
 * that; a single script with no imports does, and it loads the same way from
 * the dev server, a production build and the packaged app's file:// pages.
 */
export function worklet(): Plugin {
  /** Every source file inside a worklet bundle, mapped to the bundles it is in. */
  const sources = new Map<string, Set<string>>()

  return {
    name: 'vibrato:worklet',
    enforce: 'pre',

    async resolveId(source, importer) {
      if (!source.endsWith(SUFFIX)) return null
      const resolved = await this.resolve(source.slice(0, -SUFFIX.length), importer, { skipSelf: true })
      return resolved ? PREFIX + resolved.id : null
    },

    async load(id) {
      if (!id.startsWith(PREFIX)) return null
      const entry = id.slice(PREFIX.length)
      const result = await build({
        configFile: false,
        logLevel: 'warn',
        build: { write: false, lib: { entry, formats: ['iife'], name: 'worklet' } },
      })
      const outputs = Array.isArray(result) ? result : [result]
      const first = outputs[0]
      const chunk = 'output' in first ? first.output.find((item) => item.type === 'chunk') : undefined
      if (!chunk || chunk.type !== 'chunk') throw new Error(`Could not bundle the worklet ${entry}`)
      for (const file of chunk.moduleIds) {
        this.addWatchFile(file)
        if (!sources.has(file)) sources.set(file, new Set())
        sources.get(file)!.add(id)
      }
      return `export default ${JSON.stringify(chunk.code)}`
    },

    // A processor's name can be registered once per audio context, so new
    // worklet code needs a fresh page, not a hot update.
    handleHotUpdate({ file, server }) {
      const bundles = sources.get(file)
      if (!bundles) return
      for (const id of bundles) {
        const module = server.moduleGraph.getModuleById(id)
        if (module) server.moduleGraph.invalidateModule(module)
      }
      server.hot.send({ type: 'full-reload' })
      return []
    },
  }
}
