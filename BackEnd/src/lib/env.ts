import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

const candidatePaths = [
  process.env.DOTENV_CONFIG_PATH,
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env')
].filter((value): value is string => Boolean(value))

const seen = new Set<string>()

for (const candidate of candidatePaths) {
  const normalizedPath = path.resolve(candidate)

  if (seen.has(normalizedPath) || !fs.existsSync(normalizedPath)) {
    continue
  }

  dotenv.config({
    path: normalizedPath,
    override: false
  })

  seen.add(normalizedPath)
}
