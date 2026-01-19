const logger = {
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args)
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args)
  },
  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${message}`, ...args)
  },
  log: (message: string, ...args: any[]) => {
    console.log(`[LOG] ${message}`, ...args)
  },
}

export default logger
