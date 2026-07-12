import PDFDocument from 'pdfkit';

/**
 * Generates a PDF invoice for a given order and tenant and returns it as a Buffer.
 * Ensures the PDF Buffer is fully finalized (PDFKit collects chunks into a Buffer).
 */
export function generateInvoiceBuffer(order: any, tenant: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', (err) => {
        reject(err);
      });

      const storeName = tenant?.name || 'Luxe Fashion';

      // ── Header Section ────────────────────────────────────────────────────────
      doc.fillColor('#1c1917'); // Dark slate text color (luxury/minimalist)
      doc.fontSize(22).font('Helvetica-Bold').text(storeName.toUpperCase(), 50, 50);
      doc.fontSize(10).font('Helvetica').fillColor('#78716c').text('INVOICE', 50, 75);

      // Order Reference and Date (Top Right)
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1c1917').text('INVOICE DETAILS', 400, 50, { align: 'right' });
      doc.font('Helvetica').fillColor('#78716c');
      doc.text(`Order Ref: #${order.id.substring(0, 8).toUpperCase()}`, 400, 65, { align: 'right' });
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('ro-RO')}`, 400, 78, { align: 'right' });
      doc.text(`Status: ${order.status}`, 400, 91, { align: 'right' });

      // Horizontal line separator
      doc.moveTo(50, 120).lineTo(562, 120);
      doc.strokeColor('#e7e5e4');
      doc.lineWidth(1);
      doc.stroke();

      // ── Client / Customer Details ─────────────────────────────────────────────
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1c1917').text('BILL TO', 50, 140);
      doc.font('Helvetica').fillColor('#44403c');
      doc.text(order.customerName, 50, 155);
      doc.text(order.customerEmail, 50, 168);

      // ── Table Section ─────────────────────────────────────────────────────────
      const tableTop = 210;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#78716c');
      doc.text('PRODUCT DESCRIPTION', 50, tableTop);
      doc.text('QTY', 350, tableTop, { width: 30, align: 'right' });
      doc.text('UNIT PRICE', 400, tableTop, { width: 70, align: 'right' });
      doc.text('TOTAL', 490, tableTop, { width: 72, align: 'right' });

      // Table divider
      doc.moveTo(50, 222).lineTo(562, 222);
      doc.strokeColor('#d6d3d1');
      doc.lineWidth(1);
      doc.stroke();

      let currentY = tableTop + 20;
      doc.font('Helvetica').fillColor('#1c1917');

      for (const item of (order.items || [])) {
        const productName = item.product?.name || "Deleted Product";
        const quantity = item.quantity;
        const unitPrice = Number(item.price);
        const itemTotal = unitPrice * quantity;

        doc.text(productName, 50, currentY, { width: 280 });
        doc.text(quantity.toString(), 350, currentY, { width: 30, align: 'right' });
        doc.text(`${unitPrice.toFixed(2)} RON`, 400, currentY, { width: 70, align: 'right' });
        doc.text(`${itemTotal.toFixed(2)} RON`, 490, currentY, { width: 72, align: 'right' });

        currentY += 22;
      }

      // Divider after items
      doc.moveTo(50, currentY).lineTo(562, currentY);
      doc.strokeColor('#e7e5e4');
      doc.lineWidth(0.5);
      doc.stroke();

      // ── Summary Section ───────────────────────────────────────────────────────
      currentY += 15;
      const totalAmount = Number(order.totalAmount);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1c1917');
      doc.text('TOTAL AMOUNT DUE:', 320, currentY, { width: 150, align: 'right' });
      doc.fontSize(12).text(`${totalAmount.toFixed(2)} RON`, 480, currentY - 2, { width: 82, align: 'right' });

      // Footer note
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#a8a29e');
      doc.text('Thank you for your business. For support, please contact us.', 50, 700, { align: 'center', width: 512 });

      // End document
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
