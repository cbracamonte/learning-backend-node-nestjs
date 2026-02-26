type State = "CLOSED" | "OPEN" | "HALF_OPEN";

interface Options {
  failureThreshold: number;
  recoveryTimeout: number;
}

export class CircuitBreaker {
  private state: State = "CLOSED";
  private failureCount: number = 0;
  private nextAttempt: number = 0;

  constructor(private readonly options: Options) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
        console.log("⏳ HALF_OPEN");
      } else {
        throw new Error("Circuit is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      console.log("✅ CIRCUIT BREAKER CLOSED");
    }
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
      console.log("❌ CIRCUIT BREAKER OPEN");
    }
  }
}
