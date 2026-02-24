import { Readable } from 'stream';

export class BankTransactionStream {
  stream(): Readable {
    let count = 0;
    const max = 50000 // simula un flujo de 50k transacciones (podría ser infinito o un API real);

    // Un Readable personalizado que genera objetos de transacción bancaria.
    return new Readable({
      objectMode: true,
      highWaterMark: 100,
      read() {
        if (count >= max) {
          this.push(null);
          return;
        }

        count++;

        this.push({
          id: count,
          amount: Math.random() * 1000,
          timestamp: Date.now()
        });
      }
    });
  }
}