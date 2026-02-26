import { createNotificationModule } from "./src/notification/notification.module";

async function main() {
  const notificationModule = createNotificationModule();

  setInterval(async () => {
    try {
      await notificationModule.sendNotification(
        "user123",
        "Hello, this is a test notification!",
      );
    } catch (error: any) {
      console.log("Error sending notification:", error.message);
    }
  }, 1000);
}

main();
