import * as fs from 'fs';
import * as path from 'path';

/**
 * PersistenceService
 *
 * Guarda facturas fallidas en un archivo JSON
 * Previene pérdida de datos
 */

export interface FailedInvoiceRecord {
  invoiceId: string;
  invoiceData: any;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  lastAttemptTime: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'failed';
}

export class PersistenceService {
  private filePath: string;
  private failedInvoices: Map<string, FailedInvoiceRecord> = new Map();

  constructor(filename: string = 'failed-invoices.json') {
    this.filePath = path.resolve(process.cwd(), filename);
    this.loadFromDisk();
  }

  /**
   * Cargar registros del disco
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const records: FailedInvoiceRecord[] = JSON.parse(data);
        for (const record of records) {
          this.failedInvoices.set(record.invoiceId, record);
        }
      }
    } catch (error) {
      console.warn('⚠️  No se pudo cargar registros previos:', error);
    }
  }

  /**
   * Guardar facturas fallidas
   */
  saveFailed(
    invoiceId: string,
    invoiceData: any,
    error: string,
    attempts: number,
    maxAttempts: number,
  ): void {
    const record: FailedInvoiceRecord = {
      invoiceId,
      invoiceData,
      attempts,
      maxAttempts,
      lastError: error,
      lastAttemptTime: new Date().toISOString(),
      createdAt: this.failedInvoices.has(invoiceId)
        ? this.failedInvoices.get(invoiceId)!.createdAt
        : new Date().toISOString(),
      status: 'pending',
    };

    this.failedInvoices.set(invoiceId, record);
    this.saveToDisk();
  }

  /**
   * Guardar a disco
   */
  private saveToDisk(): void {
    try {
      const records = Array.from(this.failedInvoices.values());
      fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2));
    } catch (error) {
      console.error('❌ Error al guardar facturas fallidas:', error);
    }
  }

  /**
   * Marcar una factura como procesada exitosamente
   */
  markAsSuccess(invoiceId: string): void {
    this.failedInvoices.delete(invoiceId);
    this.saveToDisk();
  }

  /**
   * Obtener facturas pendientes de reintentar
   */
  getPendingInvoices(): FailedInvoiceRecord[] {
    return Array.from(this.failedInvoices.values()).filter((r) => r.status === 'pending');
  }

  /**
   * Obtener todas las facturas fallidas
   */
  getAllFailed(): FailedInvoiceRecord[] {
    return Array.from(this.failedInvoices.values());
  }

  /**
   * Limpiar archivos de persistencia
   */
  clear(): void {
    this.failedInvoices.clear();
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  /**
   * Imprimir informe de facturas fallidas
   */
  printFailedInvoicesReport(): void {
    const failed = this.getAllFailed();

    if (failed.length === 0) {
      console.log('✅ No hay facturas fallidas pendientes de reintentar\n');
      return;
    }

    console.log('\n📌 FACTURAS FALLIDAS (PENDIENTES DE REINTENTAR)');
    console.log('═══════════════════════════════════════════');
    for (const record of failed) {
      console.log(`🔴 ${record.invoiceId}`);
      console.log(`   Intentos: ${record.attempts}/${record.maxAttempts}`);
      console.log(`   Último error: ${record.lastError}`);
      console.log(`   Último intento: ${new Date(record.lastAttemptTime).toLocaleString()}`);
      console.log('');
    }
    console.log('═══════════════════════════════════════════\n');
  }
}
