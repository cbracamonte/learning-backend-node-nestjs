export type InvoiceStatus = 'PENDING' | 'SENT';

export class Invoice {
  constructor(
    public readonly externalId: string,
    public readonly amount: number,
    public status: InvoiceStatus
  ) {}

  markAsSent() {
    this.status = 'SENT';
  }
}