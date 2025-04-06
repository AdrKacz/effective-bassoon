import { resolve } from 'path'
import { globSync } from 'glob'
import { empty } from 'valibot'

const files = globSync(
    ['web/**/*.html', 'web/**/*.css', 'web/**/*.mjs'],
    { ignore: ['web/dist/**'] })
    .map((file) => resolve(__dirname, file))

console.log('Vite config files:', files)
const jsFiles = globSync('web/**/*.js', { ignore: ['web/dist/**'] })
if (jsFiles.length > 0) {
    throw new Error(`JavaScript files are not allowed in the web package: ${jsFiles.join(', ')}`)
}

/** @type {import('vite').UserConfig} */
export default {
    // config options
    root: 'web',
    build: {
        emptyOutDir: true,
        outDir: 'dist',
        rollupOptions: { input: files }
    },
}