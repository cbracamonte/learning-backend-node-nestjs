import { CircuitBreaker } from "../shared/services/circuit-breaker.service";
import { SendNotificationUseCase } from "./application/send-notification.usecase";
import { FakePushProviderClient } from "./infraestructure/fake-push-provider.client";

export function createNotificationModule() {
  const provider = new FakePushProviderClient();

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 1000,
  });

  const useCase = new SendNotificationUseCase(provider, circuitBreaker);

  return {
    sendNotification: (recipient: string, message: string) =>
      useCase.execute(recipient, message),
  };
}
