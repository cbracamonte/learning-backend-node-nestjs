import { SendInvoiceUseCase } from "../invoice/application/send-invoice.usecase";
import { InvoiceApiClient } from "../invoice/infraestructure/invoice-api.client";
import { MongoInvoiceRepository } from "../invoice/infraestructure/mongo-invoice.repository";
import { logger } from "../shared/infraestructure/logger.service";
import { connectMongo, getMongoClient } from "../shared/infraestructure/mongo-client.service";
import { RetryService } from "../shared/retry.service";


export async function bootstrap() {
  try {
    await connectMongo();

    const repository = new MongoInvoiceRepository();
    const api = new InvoiceApiClient();
    const retry = new RetryService();

    const sendInvoice = new SendInvoiceUseCase(repository, api, retry);

    logger.info('Sistema de facturación iniciado');

    // Simulación de envío
    await sendInvoice.execute('INV-002', 1002);

    // Ejecutar nuevamente para probar idempotencia
    await sendInvoice.execute('INV-002', 1002);

    logger.info('✅ Proceso completado correctamente');
  } finally {
    // Cerrar conexión a MongoDB
    await getMongoClient().close();
    logger.info('Conexión a MongoDB cerrada');
    process.exit(0);
  }
}