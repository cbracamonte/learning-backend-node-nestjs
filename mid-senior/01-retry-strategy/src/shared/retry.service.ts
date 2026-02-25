import { LoggerService } from './logger.service';
import { PersistenceService } from './persistence.service';

/**
 * RetryService
 *
 * Implementa:
 * - Máximo número de intentos
 * - Exponential backoff
 * - Jitter
 * - Diferenciación de errores retryables
 * - Logging de intentos
 * - Persistencia de fallos
 */

export interface RetryOptions {
  maxAttempts: number; // Número máximo de intentos
  baseDelayMs: number; // Tiempo base para el backoff (en milisegundos)
  shouldRetry?: (error: any) => boolean; // Función para determinar si un error es retryable
  invoiceId?: string; // ID de la factura para logging
  logger?: LoggerService; // Servicio de logging
  persistence?: PersistenceService; // Servicio de persistencia
}

export class RetryService {
  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
  ): Promise<T> {
    let attempt = 0;

    while (attempt < options.maxAttempts) {
      try {
        if (options.logger && options.invoiceId) {
          options.logger.log(options.invoiceId, attempt + 1, 'attempt', 'Iniciando intento...');
        }

        const result = await operation();

        if (options.logger && options.invoiceId) {
          options.logger.log(options.invoiceId, attempt + 1, 'success', 'Factura enviada exitosamente');
        }

        if (options.persistence && options.invoiceId) {
          options.persistence.markAsSuccess(options.invoiceId);
        }

        return result;
      } catch (error: any) {
        attempt++;

        // Verificar si el error es retryable
        const retryable = options.shouldRetry
          ? options.shouldRetry(error)
          : true;

        if (!retryable || attempt >= options.maxAttempts) {
          if (options.logger && options.invoiceId) {
            options.logger.log(
              options.invoiceId,
              attempt,
              'failed',
              `Fallo final después de ${attempt} intentos`,
              error.message,
            );
          }

          if (options.persistence && options.invoiceId) {
            options.persistence.saveFailed(
              options.invoiceId,
              null,
              error.message,
              attempt,
              options.maxAttempts,
            );
          }

          throw error; // No es retryable o se alcanzó el máximo de intentos
        }

        const delay = this.calculateBackoff(attempt, options.baseDelayMs);

        if (options.logger && options.invoiceId) {
          options.logger.log(
            options.invoiceId,
            attempt,
            'attempt',
            `Error (${error.message}). Reintentando en ${delay.toFixed(0)}ms...`,
            error.message,
          );
        }

        await this.sleep(delay); // Esperar antes de reintentar
      }
    }

    throw new Error('Retry failed unexpectedly');
  }

  private calculateBackoff(attempt: number, baseDelayMs: number): number {
    const exponentialBackoff = baseDelayMs * 2 ** (attempt - 1);

    const jitter = exponentialBackoff * 0.3 * Math.random(); // Agregar jitter del (0 - 30% random)
    return exponentialBackoff + jitter;
  }

  private sleep(ms: number): Promise<void> {
    // Simula un retraso utilizando setTimeout
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
