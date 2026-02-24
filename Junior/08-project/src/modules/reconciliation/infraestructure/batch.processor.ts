export async function processInBatches<T>(
  source: AsyncIterable<T>,
  batchSize: number,
  handler: (batch: T[]) => Promise<void>
) {
  let buffer: T[] = [];

  for await (const item of source) {
    buffer.push(item);

    if (buffer.length >= batchSize) {
      await handler(buffer);
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    await handler(buffer);
  }
}