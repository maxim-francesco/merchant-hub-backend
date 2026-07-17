import nodemailer from 'nodemailer';

// Helper to check if SMTP credentials are missing
export function isMailMock(): boolean {
  return !process.env.SMTP_USER || !process.env.SMTP_PASS;
}

// Function to get the SMTP transporter
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a clean, minimalist receipt email with a PDF invoice attachment.
 * Supports a mock fallback if the SMTP_USER or SMTP_PASS is missing.
 */
export async function sendReceiptEmail(
  customerEmail: string,
  order: any,
  tenant: any,
  pdfBuffer: Buffer
): Promise<void> {
  const storeName = tenant?.name || 'Luxe Fashion';
  const shortId = order.id.substring(0, 8).toUpperCase();
  const invoiceFilename = `Invoice-${shortId}.pdf`;

  // Mock Fallback
  if (isMailMock()) {
    console.log('\n=========================================');
    console.log('📬 [MOCK EMAIL SERVICE] Simulated Success');
    console.log(`To: ${customerEmail}`);
    console.log(`Subject: Your receipt from ${storeName} (Order #${shortId})`);
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
              <strong>#${shortId}</strong>
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

  try {
    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM || `${storeName} <${process.env.SMTP_USER}>`;
    await transporter.sendMail({
      from,
      to: customerEmail,
      subject: `Your receipt from ${storeName} (Order #${shortId})`,
      html: htmlTemplate,
      attachments: [
        {
          filename: invoiceFilename,
          content: pdfBuffer,
        },
      ],
    });
  } catch (error: any) {
    console.error(`Failed to send receipt email for order ${order.id}:`, error.message || error);
  }
}

/**
 * Helper to format currency in Romanian style (e.g. 12,50 RON)
 */
function formatPrice(amount: any): string {
  const value = typeof amount === 'number' ? amount : Number(amount || 0);
  const formatted = value.toFixed(2).replace('.', ',');
  return `${formatted} RON`;
}

/**
 * Helper to build rows for ordered products
 */
function buildItemsTableRows(items: any[]): string {
  if (!items || items.length === 0) {
    return `
      <tr>
        <td colspan="3" style="padding: 12px 8px; text-align: center; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #6b7280; border-bottom: 1px solid #E7E5E0;">
          Niciun produs în comandă.
        </td>
      </tr>
    `;
  }

  return items
    .map((item: any, index: number) => {
      const productName = item.product?.name || 'Produs';
      const qty = item.quantity || 0;
      const unitPrice = item.price ? Number(item.price) : 0;
      const lineTotal = qty * unitPrice;
      const bg = index % 2 === 0 ? '#FFFFFF' : '#FAF8F3';

      return `
        <tr style="background-color: ${bg};">
          <td style="padding: 12px 8px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #1f2a24; border-bottom: 1px solid #E7E5E0; text-align: left; line-height: 1.4;">
            ${productName}
          </td>
          <td style="padding: 12px 8px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #1f2a24; border-bottom: 1px solid #E7E5E0; text-align: center;">
            ${qty}
          </td>
          <td style="padding: 12px 8px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #1f2a24; border-bottom: 1px solid #E7E5E0; text-align: right; white-space: nowrap; font-weight: bold;">
            ${formatPrice(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Sends order confirmation to the customer.
 */
export async function sendOrderConfirmationEmail(
  order: any,
  tenant: any,
  opts?: { pdfBuffer?: Buffer }
): Promise<void> {
  try {
    const storeName = tenant?.name || 'Luxe Fashion';
    const shortId = order.id.substring(0, 8).toUpperCase();
    const invoiceFilename = `Invoice-${shortId}.pdf`;
    const paymentLine = order.paymentMethod === 'ramburs'
      ? "Plata se face la livrare (ramburs). Te contactăm în curând pentru confirmarea livrării."
      : "Plata a fost inițiată online.";

    // Mock Fallback
    if (isMailMock()) {
      console.log('\n=========================================');
      console.log('📬 [MOCK EMAIL SERVICE] Simulated Success (Confirmation)');
      console.log(`To: ${order.customerEmail}`);
      console.log(`Subject: Confirmare comandă #${shortId} — Coana Ana`);
      if (opts?.pdfBuffer) {
        console.log(`Attachment: ${invoiceFilename} (${opts.pdfBuffer.length} bytes)`);
      }
      console.log('-----------------------------------------');
      console.log(`Salute: Salut ${order.customerName || 'Client'},`);
      console.log(`Order: #${shortId}`);
      console.log(`Items: ${order.items?.map((i: any) => `${i.product?.name || 'Produs'} x ${i.quantity}`).join(', ') || 'Niciun produs'}`);
      console.log(`Total: ${Number(order.totalAmount).toFixed(2)} RON`);
      console.log(`Delivery Address: ${order.deliveryAddress || 'Nespecificată'}`);
      console.log(`Phone: ${order.phone || 'Nespecificat'}`);
      console.log(`Payment: ${paymentLine}`);
      console.log('=========================================\n');
      return;
    }

    const customerName = order.customerName || 'Client';
    const deliveryAddress = order.deliveryAddress || 'Nespecificată';
    const phone = order.phone || 'Nespecificat';

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="ro">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmare comandă #${shortId} — Coana Ana</title>
        </head>
        <body style="margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #FAF8F3;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #FAF8F3; width: 100%; margin: 0; padding: 40px 10px;">
            <tr>
              <td align="center" style="padding: 40px 10px;">
                <!-- Main Container Card -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E7E5E0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                  <!-- 1. Header Band -->
                  <tr>
                    <td style="background-color: #4A7C3F; padding: 32px 24px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 28px; font-weight: bold; letter-spacing: 0.5px; line-height: 1.2;">Coana Ana 🍃</h1>
                      <p style="margin: 6px 0 0 0; color: #E8F0E6; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Piață locală · Cluj-Napoca</p>
                    </td>
                  </tr>
                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 32px 24px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color: #1f2a24; font-size: 15px; line-height: 1.6;">
                      <!-- 2. Greeting -->
                      <p style="margin: 0 0 12px 0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 20px; font-weight: bold; color: #1f2a24; line-height: 1.4;">
                        Salut ${customerName},
                      </p>
                      <p style="margin: 0 0 24px 0; color: #1f2a24;">
                        Îți mulțumim pentru comandă! Am primit-o și o pregătim.
                      </p>

                      <!-- 3. Order Meta Row -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px; border-bottom: 1px solid #E7E5E0; padding-bottom: 12px;">
                        <tr>
                          <td style="font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 13px; color: #6b7280; padding-bottom: 12px;">
                            Comanda <strong style="color: #1f2a24;">#${shortId}</strong>
                          </td>
                          <td align="right" style="font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 13px; color: #6b7280; padding-bottom: 12px;">
                            Dată: <strong style="color: #1f2a24;">${new Date(order.createdAt).toLocaleDateString('ro-RO')}</strong>
                          </td>
                        </tr>
                      </table>

                      <!-- 4. Items Table -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 8px;">
                        <thead>
                          <tr>
                            <th align="left" style="padding: 10px 8px; border-bottom: 2px solid #E7E5E0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 14px; color: #1f2a24; font-weight: bold;">Produs</th>
                            <th align="center" style="padding: 10px 8px; border-bottom: 2px solid #E7E5E0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 14px; color: #1f2a24; font-weight: bold; width: 60px;">Cant.</th>
                            <th align="right" style="padding: 10px 8px; border-bottom: 2px solid #E7E5E0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 14px; color: #1f2a24; font-weight: bold; width: 100px;">Preț</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${buildItemsTableRows(order.items)}
                        </tbody>
                      </table>

                      <!-- 5. Total Row -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
                        <tr>
                          <td align="right" style="font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 20px; color: #C1613D; font-weight: bold; padding: 12px 8px 12px 0;">
                            Total: ${formatPrice(order.totalAmount)}
                          </td>
                        </tr>
                      </table>

                      <!-- 6. Delivery Block -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border: 1px solid #E7E5E0; background-color: #FAF8F3; border-radius: 8px; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color: #1f2a24; font-size: 14px; line-height: 1.6;">
                            <strong style="font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 16px; color: #1f2a24; display: block; margin-bottom: 12px; border-bottom: 1px solid #E7E5E0; padding-bottom: 8px;">Detalii Livrare & Plată</strong>
                            <p style="margin: 0 0 8px 0;"><span style="color: #6b7280;">Livrare la:</span> ${deliveryAddress}</p>
                            <p style="margin: 0 0 16px 0;"><span style="color: #6b7280;">Telefon:</span> ${phone}</p>
                            
                            <!-- Payment badge -->
                            ${order.paymentMethod === 'ramburs' ? `
                              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 6px;">
                                <tr>
                                  <td style="background-color: #FDF0EB; border: 1px solid #F6D3C4; border-radius: 12px; padding: 6px 14px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 12px; font-weight: bold; color: #C1613D; text-transform: uppercase; white-space: nowrap;">
                                    Ramburs — plata la livrare
                                  </td>
                                </tr>
                              </table>
                              <p style="margin: 6px 0 0 0; font-size: 13px; color: #6b7280; font-style: italic;">
                                Te sunăm în scurt timp pentru a confirma livrarea.
                              </p>
                            ` : `
                              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <tr>
                                  <td style="background-color: #EBF5EA; border: 1px solid #CDE7CB; border-radius: 12px; padding: 6px 14px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 12px; font-weight: bold; color: #4A7C3F; text-transform: uppercase; white-space: nowrap;">
                                    Plată online
                                  </td>
                                </tr>
                              </table>
                            `}
                          </td>
                        </tr>
                      </table>

                      ${opts?.pdfBuffer ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #1f2a24;">Am atașat factura în format PDF la acest e-mail pentru evidența ta.</p>` : ''}
                      <p style="margin: 0; font-size: 14px; color: #1f2a24;">Dacă ai întrebări, răspunde direct la acest e-mail.</p>

                      <!-- 7. Footer -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border-top: 1px solid #E7E5E0; margin-top: 28px;">
                        <tr>
                          <td style="padding: 24px 0 0 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 12px; color: #6b7280; text-align: center; line-height: 1.6;">
                            <!-- TODO: replace with real business data -->
                            Coana Ana SRL &middot; CUI: RO00000000 &middot; Str. Exemplu nr. 0, Cluj-Napoca<br>
                            Tel: 07XX XXX XXX &middot; contact@coanaana.ro
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM || `${storeName} <${process.env.SMTP_USER}>`;
    const attachments = opts?.pdfBuffer
      ? [
          {
            filename: invoiceFilename,
            content: opts.pdfBuffer,
          },
        ]
      : [];

    const info = await transporter.sendMail({
      from,
      to: order.customerEmail,
      subject: `Confirmare comandă #${shortId} — Coana Ana`,
      html: htmlTemplate,
      attachments,
    });
    console.log(`[LIVE SEND] Order confirmation email sent successfully. MessageID: ${info.messageId}`);
  } catch (error: any) {
    console.error(`Failed to send order confirmation email for order ${order.id}:`, error.message || error);
  }
}

/**
 * Sends owner new order alert.
 */
export async function sendOwnerNewOrderAlert(
  ownerEmail: string,
  order: any,
  tenant: any
): Promise<void> {
  try {
    const storeName = tenant?.name || 'Luxe Fashion';
    const shortId = order.id.substring(0, 8).toUpperCase();
    const paymentMethodLabel = order.paymentMethod === 'ramburs' ? 'Ramburs' : 'Card';

    // Mock Fallback
    if (isMailMock()) {
      console.log('\n=========================================');
      console.log('📬 [MOCK EMAIL SERVICE] Simulated Success (Owner Alert)');
      console.log(`To: ${ownerEmail}`);
      console.log(`Subject: Comandă nouă #${shortId} — ${order.customerName}`);
      console.log('-----------------------------------------');
      console.log(`Owner alert for store: ${storeName}`);
      console.log(`Customer: ${order.customerName}`);
      console.log(`Phone: ${order.phone || 'Nespecificat'}`);
      console.log(`Delivery Address: ${order.deliveryAddress || 'Nespecificată'}`);
      console.log(`Payment Method: ${paymentMethodLabel}`);
      console.log(`Total: ${Number(order.totalAmount).toFixed(2)} RON`);
      console.log(`Items: ${order.items?.map((i: any) => `${i.product?.name || 'Produs'} x ${i.quantity}`).join(', ') || 'Niciun produs'}`);
      console.log('=========================================\n');
      return;
    }

    const customerName = order.customerName || 'Client';

    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="ro">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Comandă nouă #${shortId}</title>
        </head>
        <body style="margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #FAF8F3;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #FAF8F3; width: 100%; margin: 0; padding: 40px 10px;">
            <tr>
              <td align="center" style="padding: 40px 10px;">
                <!-- Main Container Card -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E7E5E0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                  <!-- 1. Header Band -->
                  <tr>
                    <td style="background-color: #4A7C3F; padding: 20px 24px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 22px; font-weight: bold; letter-spacing: 0.5px; line-height: 1.2;">Comandă nouă 🍃</h1>
                    </td>
                  </tr>
                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 32px 24px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color: #1f2a24; font-size: 15px; line-height: 1.6;">
                      <!-- 2. Big Action Line -->
                      <p style="margin: 0 0 24px 0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 20px; font-weight: bold; color: #1f2a24; text-align: center;">
                        Ai o comandă nouă de procesat.
                      </p>

                      <!-- 3. Customer Block (Prominent) -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border: 1px solid #E7E5E0; background-color: #FAF8F3; border-radius: 8px; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color: #1f2a24; font-size: 14px; line-height: 1.6;">
                            <strong style="font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 16px; color: #1f2a24; display: block; margin-bottom: 12px; border-bottom: 1px solid #E7E5E0; padding-bottom: 8px;">Date Client</strong>
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                              <tr>
                                <td style="padding: 4px 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #6b7280; width: 120px; vertical-align: top;"><strong>Nume:</strong></td>
                                <td style="padding: 4px 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #1f2a24; vertical-align: top;"><strong>${customerName}</strong></td>
                              </tr>
                              <tr>
                                <td style="padding: 4px 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #6b7280; vertical-align: top;"><strong>Telefon:</strong></td>
                                <td style="padding: 4px 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #1f2a24; vertical-align: top;">${order.phone || 'Nespecificat'}</td>
                              </tr>
                              <tr>
                                <td style="padding: 4px 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #6b7280; vertical-align: top;"><strong>Adresă de livrare:</strong></td>
                                <td style="padding: 4px 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 14px; color: #1f2a24; vertical-align: top;">${order.deliveryAddress || 'Nespecificată'}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- 4. Payment + Total -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
                        <tr>
                          <td valign="middle">
                            ${order.paymentMethod === 'ramburs' ? `
                              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <tr>
                                  <td style="background-color: #FDF0EB; border: 1px solid #F6D3C4; border-radius: 12px; padding: 6px 14px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 12px; font-weight: bold; color: #C1613D; text-transform: uppercase;">
                                    Ramburs
                                  </td>
                                </tr>
                              </table>
                            ` : `
                              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <tr>
                                  <td style="background-color: #EBF5EA; border: 1px solid #CDE7CB; border-radius: 12px; padding: 6px 14px; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 12px; font-weight: bold; color: #4A7C3F; text-transform: uppercase;">
                                    Card
                                  </td>
                                </tr>
                              </table>
                            `}
                          </td>
                          <td align="right" valign="middle" style="font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 18px; color: #C1613D; font-weight: bold;">
                            Total: ${formatPrice(order.totalAmount)}
                          </td>
                        </tr>
                      </table>

                      <!-- 5. Items Table -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 8px;">
                        <thead>
                          <tr>
                            <th align="left" style="padding: 10px 8px; border-bottom: 2px solid #E7E5E0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 14px; color: #1f2a24; font-weight: bold;">Produs</th>
                            <th align="center" style="padding: 10px 8px; border-bottom: 2px solid #E7E5E0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 14px; color: #1f2a24; font-weight: bold; width: 60px;">Cant.</th>
                            <th align="right" style="padding: 10px 8px; border-bottom: 2px solid #E7E5E0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size: 14px; color: #1f2a24; font-weight: bold; width: 100px;">Preț</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${buildItemsTableRows(order.items)}
                        </tbody>
                      </table>

                      <!-- 6. Footer -->
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border-top: 1px solid #E7E5E0; margin-top: 28px;">
                        <tr>
                          <td style="padding: 24px 0 0 0; font-family:'Nunito',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; font-size: 12px; color: #6b7280; text-align: center;">
                            Notificare automată &middot; Coana Ana
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const transporter = getTransporter();
    const from = process.env.EMAIL_FROM || `${storeName} <${process.env.SMTP_USER}>`;
    const info = await transporter.sendMail({
      from,
      to: ownerEmail,
      subject: `Comandă nouă #${shortId} — ${customerName}`,
      html: htmlTemplate,
    });
    console.log(`[LIVE SEND] Owner alert email sent successfully. MessageID: ${info.messageId}`);
  } catch (error: any) {
    console.error(`Failed to send owner alert email for order ${order.id}:`, error.message || error);
  }
}


