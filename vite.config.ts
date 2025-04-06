import { resolve } from 'path'
import { globSync } from 'glob'

const files = globSync(
    ['web/**/*.html', 'web/**/*.css', 'web/**/*.mjs'],
    { ignore: ['dist/**', 'node_modules/**', 'vite.config.ts*'] })
    .map((file) => resolve(__dirname, file))

const jsFiles = globSync('web/**/*.js', { ignore: ['dist/**', 'node_modules/**', 'vite.config.ts*'] })
if (jsFiles.length > 0) {
    throw new Error(`JavaScript files are not allowed in the web package: ${jsFiles.join(', ')}`)
}

/** @type {import('vite').UserConfig} */
export default {
    // config options
    build: { rollupOptions: { input: files } },
    base: 'web',
}