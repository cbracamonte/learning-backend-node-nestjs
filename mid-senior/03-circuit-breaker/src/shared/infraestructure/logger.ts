export const logger = {
  info: (message: string, meta?: any) =>
    console.log(
      JSON.stringify({
        level: "info",
        message,
        meta,
        time: Date.now(),
      }),
    ),
};
