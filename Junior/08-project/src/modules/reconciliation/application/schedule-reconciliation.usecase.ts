export class ScheduleReconciliationUseCase {
  constructor(
    private readonly runUseCase: { execute(): Promise<void> }
  ) {}

  start(interval: number) {
    const schedule = async () => {
      const start = Date.now();

      await this.runUseCase.execute();

      const duration = Date.now() - start;
      const nextDelay = Math.max(0, interval - duration);

      setTimeout(schedule, nextDelay);
    };

    schedule();
  }
}