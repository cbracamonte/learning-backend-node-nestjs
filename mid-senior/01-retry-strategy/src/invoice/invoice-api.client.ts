export class InvoiceApiClient {
    async sendInvoice(invoice: any): Promise<void> {
        // Simulamos el envío de la factura a una API externa
        const random = Math.random();

        if(random < 0.6) {
            // Simulamos un error en el 60% de los casos
            const error: any = new Error('Service Unavailable');
            error.code = 503;
            throw error;
        }

        console.log('Invoice sent successfully:', invoice);
    }
}