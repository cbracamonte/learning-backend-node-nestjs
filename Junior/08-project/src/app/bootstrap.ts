import { createReconciliationModule } from "../modules/reconciliation/reconciliation.module";
import {
  connectMongo,
  getMongoClient,
  logger,
} from "../shared/infraestructure";

export async function bootstrap() {
  try {
    await connectMongo();

    const reconciliationModule = createReconciliationModule();

    logger.info("Sistema iniciado");

    reconciliationModule.start();
  } catch (error) {
    logger.error("Error durante la inicialización", error);
  } finally {
    await getMongoClient().close();
    logger.info("Sistema detenido");
    process.exit(0);
  }
}
