type Job<T> = {
  data: T;
  attempts: number;
};

export class JobQueue<T> {
  private queue: Job<T>[] = [];
  private concurrency!: number;
  private active = 0;
  private handler!: (data: T) => Promise<void>;
  private drainCallbacks: (() => void)[] = [];

  constructor(concurrency: number, handler: (data: T) => Promise<void>) {
    this.concurrency = concurrency;
    this.handler = handler;
  }

  add(data: T) {
    this.queue.push({ data, attempts: 0 });
    this.process();
  }

  /** Resolves when all queued jobs have finished processing. */
  whenDone(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.drainCallbacks.push(resolve));
  }

  private process() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!;
      this.active++;

      this.run(job);
    }
  }

  private async run(job: Job<T>) {
    try {
      await this.handler(job.data);
    } catch (error) {
      if (job.attempts < 3) {
        job.attempts++;
        this.queue.push(job);
      }
    } finally {
      this.active--;
      this.process();

      if (this.active === 0 && this.queue.length === 0) {
        const callbacks = this.drainCallbacks.splice(0);
        callbacks.forEach((cb) => cb());
      }
    }
  }
}
