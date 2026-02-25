import { Invoice } from './invoice.entity';

export interface InvoiceRepository {
  findByExternalId(id: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}