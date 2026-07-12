import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY || 're_mock_12345';
const resend = new Resend(apiKey);

/**
 * Sends a clean, minimalist receipt email with a PDF invoice attachment.
 * Supports a mock fallback if the RESEND_API_KEY starts with 're_mock'.
 */
export async function sendReceiptEmail(
  customerEmail: string,
  order: any,
  tenant: any,
  pdfBuffer: Buffer
): Promise<void> {
  const storeName = tenant?.name || 'Luxe Fashion';
  const invoiceFilename = `Invoice-${order.id.substring(0, 8)}.pdf`;

  // Mock Fallback
  if (apiKey.startsWith('re_mock')) {
    console.log('\n=========================================');
    console.log('📬 [MOCK EMAIL SERVICE] Simulated Success');
    console.log(`To: ${customerEmail}`);
    console.log(`Subject: Your receipt from ${storeName} (Order #${order.id.substring(0, 8).toUpperCase()})`);
    console.log(`Attachment: ${invoiceFilename} (${pdfBuffer.length} bytes)`);
    console.log('-----------------------------------------');
    console.log(`Dear ${order.customerName || 'Customer'},`);
    console.log(`Thank you for shopping at ${storeName}.`);
    console.log(`Your order total is ${Number(order.totalAmount).toFixed(2)} RON.`);
    console.log('=========================================\n');
    return;
  }

  // HTML Template
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #fafaf9;
            color: #1c1917;
            padding: 40px 20px;
            margin: 0;
          }
          .container {
            max-width: 580px;
            background-color: #ffffff;
            border: 1px solid #e7e5e4;
            border-radius: 8px;
            padding: 40px;
            margin: 0 auto;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          }
          h1 {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.025em;
            margin-top: 0;
            margin-bottom: 24px;
            text-transform: uppercase;
          }
          p {
            font-size: 14px;
            line-height: 1.6;
            color: #44403c;
            margin-top: 0;
            margin-bottom: 16px;
          }
          .summary {
            background-color: #f5f5f4;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 8px;
          }
          .summary-row.total {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 0;
            padding-top: 8px;
            border-top: 1px solid #e7e5e4;
          }
          .footer {
            font-size: 12px;
            color: #a8a29e;
            margin-top: 32px;
            border-top: 1px solid #f5f5f4;
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${storeName.toUpperCase()}</h1>
          <p>Hi ${order.customerName},</p>
          <p>Thank you for your purchase! We've received your payment, and your order is now being processed.</p>
          
          <div class="summary">
            <div class="summary-row">
              <span>Order Reference:</span>
              <strong>#${order.id.substring(0, 8).toUpperCase()}</strong>
            </div>
            <div class="summary-row">
              <span>Date:</span>
              <span>${new Date(order.createdAt).toLocaleDateString('ro-RO')}</span>
            </div>
            <div class="summary-row total">
              <span>Amount Paid:</span>
              <span>${Number(order.totalAmount).toFixed(2)} RON</span>
            </div>
          </div>

          <p>We have attached your official PDF invoice to this email for your records.</p>
          <p>If you have any questions or require support, reply directly to this email.</p>
          
          <div class="footer">
            Best regards,<br>
            The ${storeName} Team
          </div>
        </div>
      </body>
    </html>
  `;

  await resend.emails.send({
    from: `${storeName} <receipts@merchanthub.com>`,
    to: customerEmail,
    subject: `Your receipt from ${storeName} (Order #${order.id.substring(0, 8).toUpperCase()})`,
    html: htmlTemplate,
    attachments: [
      {
        filename: invoiceFilename,
        content: pdfBuffer,
      },
    ],
  });
}
