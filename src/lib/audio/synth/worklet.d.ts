/**
 * `?worklet` imports (see vite.worklet.ts in the repo root): the file, bundled
 * with its imports into one self-contained script, as a string.
 */
declare module '*?worklet' {
  const code: string;
  export default code;
}
