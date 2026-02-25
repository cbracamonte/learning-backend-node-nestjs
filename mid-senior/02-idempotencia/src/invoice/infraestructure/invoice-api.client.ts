export class InvoiceApiClient {
  async send(invoice: any): Promise<void> {
    const random = Math.random();

    // 60% probabilidad de fallo transitorio
    if (random < 0.6) {
      const error: any = new Error("Service unavailable");
      error.code = 503;
      throw error;
    }

    console.log(`Factura ${invoice.externalId} enviada al ente regulador`);
  }
}
