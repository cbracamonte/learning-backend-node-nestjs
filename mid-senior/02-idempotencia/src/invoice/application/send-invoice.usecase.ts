import { logger } from "../../shared/infraestructure/logger.service";
import { RetryService } from "../../shared/retry.service";
import { Invoice } from "../domain/invoice.entity";
import { InvoiceRepository } from "../domain/invoice.repository";
import { InvoiceApiClient } from "../infraestructure/invoice-api.client";

export class SendInvoiceUseCase {
  constructor(
    private readonly repository: InvoiceRepository,
    private readonly invoiceApiClient: InvoiceApiClient,
    private readonly retryService: RetryService,
  ) {}

  async execute(externalId: string, amount: number) {
    // 1. Verificar si la factura existe

    const existingInvoice = await this.repository.findByExternalId(externalId);

    if (existingInvoice && existingInvoice.status === "SENT") {
      logger.info(`Factura ${externalId} ya fue enviada previamente`);
      return;
    }

    const invoice = new Invoice(externalId, amount, "PENDING");

    await this.repository.save(invoice);

    // 2. Enviar la factura con Retry Protegido
    await this.retryService.execute(() => this.invoiceApiClient.send(invoice), {
      maxAttempts: 5,
      baseDelayMs: 500,
      shouldRetry: (error: any) => error.code === 503,
    });

    invoice.markAsSent();

    await this.repository.save(invoice);

    logger.info(`Factura ${externalId} enviada exitosamente`);
  }
}
