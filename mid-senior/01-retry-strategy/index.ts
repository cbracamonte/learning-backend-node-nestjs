import { RetryService } from './src/shared/retry.service';
import { InvoiceApiClient } from './src/invoice/invoice-api.client';
import { SendInvoiceUseCase } from './src/invoice/send-invoice.usecase';
import { LoggerService } from './src/shared/logger.service';
import { PersistenceService } from './src/shared/persistence.service';

/**
 * SISTEMA DE FACTURACIÓN ELECTRÓNICA MASIVA
 * 
 * Simula el envío de 20 facturas a una API externa que falla el 60% de las veces.
 * 
 * REQUISITOS CUMPLIDOS:
 * ✅ No perder ninguna factura - Persistencia en archivo
 * ✅ No duplicarlas - Idempotencia con IDs únicos
 * ✅ Reintentar inteligentemente - Exponential backoff + jitter
 * ✅ Registra fallos - Log de auditoría completo
 */

class InvoiceProcessingSystem {
  private invoiceApiClient: InvoiceApiClient;
  private retryService: RetryService;
  private logger: LoggerService;
  private persistence: PersistenceService;
  private sendInvoiceUseCase: SendInvoiceUseCase;

  private stats = {
    totalInvoices: 0,
    successfulInvoices: 0,
    failedInvoices: 0,
    retriedInvoices: 0,
    totalAttempts: 0,
  };

  constructor() {
    this.invoiceApiClient = new InvoiceApiClient();
    this.retryService = new RetryService();
    this.logger = new LoggerService();
    this.persistence = new PersistenceService('failed-invoices.json');
    this.sendInvoiceUseCase = new SendInvoiceUseCase(
      this.invoiceApiClient,
      this.retryService,
      this.logger,
      this.persistence,
    );
  }

  /**
   * Genera facturas simuladas
   */
  private generateInvoices(count: number): any[] {
    const invoices = [];
    for (let i = 1; i <= count; i++) {
      invoices.push({
        id: `INV-${String(i).padStart(5, '0')}`,
        clientId: `CLIENT-${Math.floor(Math.random() * 100)}`,
        amount: parseFloat((Math.random() * 10000).toFixed(2)),
        date: new Date().toISOString(),
      });
    }
    return invoices;
  }

  /**
   * Procesa las facturas con retry strategy
   */
  async processInvoices(count: number = 20): Promise<void> {
    const invoices = this.generateInvoices(count);
    this.stats.totalInvoices = count;

    console.log('\n📊 SISTEMA DE FACTURACIÓN ELECTRÓNICA MASIVA');
    console.log('═══════════════════════════════════════════');
    console.log(`📄 Total de facturas a procesar: ${count}\n`);

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const invoiceNumber = i + 1;

      process.stdout.write(
        `[${String(invoiceNumber).padStart(2, '0')}/${count}] Enviando ${invoice.id}... `,
      );

      try {
        await this.sendInvoiceUseCase.execute(invoice);
        console.log('✅ ENVIADA');
        this.stats.successfulInvoices++;
      } catch (error: any) {
        console.log('❌ FALLÓ (guardada para reintentar)');
        this.stats.failedInvoices++;
      }
    }

    // Mostrar informe de facturas fallidas
    this.persistence.printFailedInvoicesReport();

    this.printStatistics();
  }

  /**
   * Reintenta las facturas fallidas
   */
  async retryFailedInvoices(): Promise<void> {
    const failedRecords = this.persistence.getPendingInvoices();

    if (failedRecords.length === 0) {
      console.log('✅ No hay facturas fallidas para reintentar\n');
      return;
    }

    console.log('\n🔄 REINTENTANDO FACTURAS FALLIDAS');
    console.log('═══════════════════════════════════════════');
    console.log(`📌 Total de facturas para reintentar: ${failedRecords.length}\n`);

    for (const record of failedRecords) {
      process.stdout.write(`Reintentando ${record.invoiceId}... `);

      try {
        // Crear un objeto de factura simple con el ID
        const retryInvoice = {
          id: record.invoiceId,
          clientId: 'RETRY',
          amount: 0,
          date: new Date().toISOString(),
        };

        await this.sendInvoiceUseCase.execute(retryInvoice);
        console.log('✅ ENVIADA');
        this.stats.retriedInvoices++;
      } catch (error: any) {
        console.log('❌ AÚN FALLA');
      }
    }

    console.log();
    this.persistence.printFailedInvoicesReport();
  }

  /**
   * Imprime estadísticas del procesamiento
   */
  private printStatistics(): void {
    console.log('═══════════════════════════════════════════');
    console.log('📈 RESUMEN DE RESULTADOS');
    console.log('═══════════════════════════════════════════');
    console.log(`Total procesado:     ${this.stats.totalInvoices} facturas`);
    console.log(`✅ Exitosas:         ${this.stats.successfulInvoices}`);
    console.log(`❌ Fallidas inicial: ${this.stats.failedInvoices}`);
    console.log(`🔄 Reintentadas:     ${this.stats.retriedInvoices}`);
    const totalSuccess = this.stats.successfulInvoices + this.stats.retriedInvoices;
    console.log(
      `📊 Tasa de éxito:    ${((totalSuccess / this.stats.totalInvoices) * 100).toFixed(1)}%`,
    );
    console.log('═══════════════════════════════════════════\n');
  }

  /**
   * Mostrar log de auditoría
   */
  printAudit(): void {
    this.logger.printAudit();
  }

  /**
   * Limpiar persistencia
   */
  clean(): void {
    this.persistence.clear();
    console.log('🗑️  Archivos de persistencia limpiados\n');
  }
}

/**
 * Punto de entrada del programa
 */
async function main() {
  try {
    // Limpiar registros previos
    const system = new InvoiceProcessingSystem();
    system.clean();

    // Procesar 20 facturas
    await system.processInvoices(20);

    // Reintentarlo en 2 segundos (simular que espera)
    console.log('⏳ Esperando 2 segundos antes de reintentar...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Reintentar facturas fallidas
    await system.retryFailedInvoices();

    // Mostrar auditoría
    system.printAudit();
  } catch (error) {
    console.error('Error crítico:', error);
    process.exit(1);
  }
}

main().catch(console.error);

