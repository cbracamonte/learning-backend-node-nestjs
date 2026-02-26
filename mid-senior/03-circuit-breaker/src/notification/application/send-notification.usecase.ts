import { logger } from "../../shared/infraestructure/logger";
import { CircuitBreaker } from "../../shared/services/circuit-breaker.service";
import { Notification } from "../domain/notification.entity";
import { PushProvider } from "../domain/push-provider.interface";

export class SendNotificationUseCase {
  constructor(
    private readonly provider: PushProvider,
    private readonly circuitBreaker: CircuitBreaker,
  ) {}

  async execute(message: string, recipient: string): Promise<void> {
    const newNotification = new Notification(message, recipient);

    await this.circuitBreaker.execute(
      () => this.provider.sendNotification(newNotification),
    );

    logger.info(`Notification sent to ${recipient}`);
  }
}
