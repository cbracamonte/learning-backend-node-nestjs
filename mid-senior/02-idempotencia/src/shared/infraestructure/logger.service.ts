export const logger = {
  info: (message: string, meta?: any) =>
    console.log(JSON.stringify({ level: 'info', message, meta, time: Date.now() })),

  error: (message: string, meta?: any) =>
    console.error(JSON.stringify({ level: 'error', message, meta, time: Date.now() }))
};