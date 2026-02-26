import { Notification } from "../domain/notification.entity";
import { PushProvider } from "../domain/push-provider.interface";

export class FakePushProviderClient implements PushProvider {
  async sendNotification(notification: Notification): Promise<void> {
    const random = Math.random();

    if (random < 0.7) {
      throw new Error("Push provider failure");
    }

    console.log("📲 Sent to:", notification.recipient);
  }
}
