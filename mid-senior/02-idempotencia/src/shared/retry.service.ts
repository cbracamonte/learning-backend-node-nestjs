export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry?: (error: any) => boolean;
}

export class RetryService {
  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    let attempt = 0;

    while (attempt < options.maxAttempts) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;

        const retryable = options.shouldRetry
          ? options.shouldRetry(error)
          : true;

        if (!retryable || attempt >= options.maxAttempts) {
          throw error;
        }

        const delay = this.calculateBackoff(
          attempt,
          options.baseDelayMs
        );

        console.log(`Retry attempt ${attempt} in ${delay.toFixed(0)}ms`);

        await this.sleep(delay);
      }
    }

    throw new Error('Retry exhausted');
  }

  private calculateBackoff(attempt: number, base: number): number {
    const exponential = base * 2 ** (attempt - 1);
    const jitter = exponential * 0.3 * Math.random();
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}