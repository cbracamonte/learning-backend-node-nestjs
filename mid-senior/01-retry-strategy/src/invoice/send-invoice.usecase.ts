import { RetryService } from "../shared/retry.service";
import { InvoiceApiClient } from "./invoice-api.client";
import { LoggerService } from "../shared/logger.service";
import { PersistenceService } from "../shared/persistence.service";

export class SendInvoiceUseCase {
  constructor(
    private readonly invoiceApiClient: InvoiceApiClient,
    private readonly retryService: RetryService,
    private readonly logger: LoggerService,
    private readonly persistence: PersistenceService,
  ) {}

  async execute(invoice: any) {
    await this.retryService.execute(
      () => this.invoiceApiClient.sendInvoice(invoice),
      {
        maxAttempts: 3, // Maximo de intentos
        baseDelayMs: 500, // Retraso base de 500ms
        shouldRetry: (error: any) => error.code === 503,
        invoiceId: invoice.id,
        logger: this.logger,
        persistence: this.persistence,
      },
    );
  }
}
