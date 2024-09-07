import path from 'node:path'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)).toString(),
)

export const VERSION = version as string

const fileNames = ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue']

export function isDirectory(url: string) {
  const fileName = path.basename(url)
  return !fileNames.some(name => fileName.endsWith(name))
}

export function makeSureString<T>(value: T) {
  return value ? value.toString() : ''
}
