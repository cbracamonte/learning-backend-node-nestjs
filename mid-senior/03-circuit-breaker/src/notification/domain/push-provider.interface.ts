import { Notification } from "./notification.entity";

export interface PushProvider {
  sendNotification(notification: Notification): Promise<void>;
}
