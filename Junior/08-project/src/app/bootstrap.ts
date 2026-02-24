import { createReconciliationModule } from "../modules/reconciliation/reconciliation.module";
import { connectMongo, logger } from "../shared/infraestructure";

export async function bootstrap() {
  await connectMongo();

  const reconciliationModule = createReconciliationModule();

  logger.info("Sistema iniciado");

  reconciliationModule.start();
}
