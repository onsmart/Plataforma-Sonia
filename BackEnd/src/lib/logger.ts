import util from 'util'

type LogLevel = 'error' | 'warn' | 'info' | 'log'

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  log: 3,
}

function resolveLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || '').toLowerCase().trim()
  if (env === 'error' || env === 'warn' || env === 'info' || env === 'log') return env
  if (env === 'debug' || env === 'verbose') return 'log'
  return process.env.NODE_ENV === 'production' ? 'info' : 'log'
}

let cachedLevel: LogLevel | null = null
function activeLevel(): LogLevel {
  if (cachedLevel === null) cachedLevel = resolveLevel()
  return cachedLevel
}

function shouldEmit(method: LogLevel): boolean {
  return LEVEL_ORDER[method] <= LEVEL_ORDER[activeLevel()]
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23)
}

function useCompactLogs(): boolean {
  return ['1', 'true', 'yes'].includes(String(process.env.LOG_COMPACT || '').trim().toLowerCase())
}

function formatExtraArgs(args: unknown[]): string {
  if (args.length === 0) return ''
  if (useCompactLogs()) {
    return ' ' + args
      .map((a) => {
        if (a instanceof Error) {
          return JSON.stringify({ error: a.message, name: a.name })
        }
        try {
          return JSON.stringify(a)
        } catch {
          return JSON.stringify(String(a))
        }
      })
      .join(' ')
  }

  const colors = process.env.NO_COLOR === '1' ? false : process.env.NODE_ENV !== 'production'
  return (
    '\n' +
    args
      .map((a) => {
        if (a instanceof Error) {
          return a.stack || `${a.name}: ${a.message}`
        }
        if (typeof a === 'object' && a !== null) {
          return util.inspect(a, {
            depth: 6,
            colors,
            maxArrayLength: 32,
            breakLength: 100,
          })
        }
        return String(a)
      })
      .join('\n')
  )
}

const logger = {
  warn: (message: string, ...args: unknown[]) => {
    if (!shouldEmit('warn')) return
    if (args.length) console.warn(`${timestamp()} [WARN] ${message}${formatExtraArgs(args)}`)
    else console.warn(`${timestamp()} [WARN] ${message}`)
  },
  error: (message: string, ...args: unknown[]) => {
    if (!shouldEmit('error')) return
    if (args.length) console.error(`${timestamp()} [ERROR] ${message}${formatExtraArgs(args)}`)
    else console.error(`${timestamp()} [ERROR] ${message}`)
  },
  info: (message: string, ...args: unknown[]) => {
    if (!shouldEmit('info')) return
    if (args.length) console.info(`${timestamp()} [INFO] ${message}${formatExtraArgs(args)}`)
    else console.info(`${timestamp()} [INFO] ${message}`)
  },
  log: (message: string, ...args: unknown[]) => {
    if (!shouldEmit('log')) return
    if (args.length) console.log(`${timestamp()} [LOG] ${message}${formatExtraArgs(args)}`)
    else console.log(`${timestamp()} [LOG] ${message}`)
  },
}

export default logger
