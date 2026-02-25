import { getMongoClient } from "../../shared/infraestructure/mongo-client.service";
import { Invoice } from "../domain/invoice.entity";
import { InvoiceRepository } from "../domain/invoice.repository";

export class MongoInvoiceRepository implements InvoiceRepository {
    async findByExternalId(id: string): Promise<Invoice | null> {
        const doc = await getMongoClient()
        .db("billing")
        .collection("invoices")
        .findOne({ externalId: id });

        if (!doc) return null;

        return new Invoice(doc.externalId, doc.amount, doc.status);
    }

    async save(invoice: Invoice): Promise<void> {
        await getMongoClient()
        .db("billing")
        .collection("invoices")
        .updateOne(
            { externalId: invoice.externalId },
            {
                $set: {
                    externalId: invoice.externalId,
                    amount: invoice.amount,
                    status: invoice.status,
                },
             },
             { upsert: true }
        );
    }
}