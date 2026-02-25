/**
 * LoggerService
 *
 * Registra todos los eventos:
 * - Intentos de envío
 * - Errores
 * - Éxitos
 * - Auditoría completa
 */

export interface LogEntry {
  timestamp: string;
  invoiceId: string;
  attempt: number;
  status: 'attempt' | 'success' | 'failed';
  message: string;
  error?: string;
}

export class LoggerService {
  private logs: LogEntry[] = [];

  log(
    invoiceId: string,
    attempt: number,
    status: 'attempt' | 'success' | 'failed',
    message: string,
    error?: string,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      invoiceId,
      attempt,
      status,
      message,
      error,
    };

    this.logs.push(entry);
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  getLogsByInvoiceId(invoiceId: string): LogEntry[] {
    return this.logs.filter((log) => log.invoiceId === invoiceId);
  }

  getFailedInvoices(): string[] {
    const failed = new Set<string>();
    for (const log of this.logs) {
      if (log.status === 'failed') {
        failed.add(log.invoiceId);
      }
    }
    return Array.from(failed);
  }

  printAudit(): void {
    console.log('\n📋 LOG DE AUDITORÍA COMPLETO');
    console.log('═══════════════════════════════════════════');
    for (const log of this.logs) {
      const statusIcon = log.status === 'success' ? '✅' : log.status === 'attempt' ? '🔄' : '❌';
      console.log(
        `${statusIcon} [${log.timestamp}] ${log.invoiceId} (Intento ${log.attempt}): ${log.message}`,
      );
      if (log.error) {
        console.log(`   Error: ${log.error}`);
      }
    }
    console.log('═══════════════════════════════════════════\n');
  }
}
