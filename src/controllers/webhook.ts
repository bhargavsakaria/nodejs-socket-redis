import { NextFunction, Request, Response } from 'express';
import {
  POSTI_CUSTOMER_NUMBER,
  POSTI_PASSWORD,
  posti_uri,
  POSTI_USERNAME,
  stripe,
  STRIPE_WEBHOOK_SECRET
} from '../utils/secrets';
import { BadRequestError } from '../helpers/apiError';
import Order from '../entities/Order.postgres';
import User from '../entities/User.postgres';
import https from 'https';

const SibApiV3Sdk = require('sib-api-v3-sdk');
let request = require('request');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fs = require('fs');

export const stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore
    const sig = req.headers['stripe-signature'];

    let event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    if (!event) {
      throw new Error('Invalid signature');
    }
    console.log('EVENT', event?.type);

    // Handle the event
    switch (event?.type) {
      case 'invoice.paid':
        // Continue to provision the subscription as payments continue to be made.
        // Store the status in your database and check when a user accesses your service.
        // This approach helps you avoid hitting rate limits.
        const invoice_paid = event.data.object;
        console.log('INVOICE PAID', invoice_paid);
        const invoice_status = invoice_paid.status;
        let order = await Order.findOne({ where: { invoiceId: invoice_paid.id } });
        if (order) {
          await Order.update(order.id, {
            paidAt: Math.round(+new Date() / 1000),
            paymentResult: invoice_status,
            isPaid: true
          });
          const user = await User.findOne(order.user.id);
          if (user) {
            const url = invoice_paid.hosted_invoice_url;
            // authentication
            const key = process.env.SIB_API_KEY;
            const defaultClient = SibApiV3Sdk.ApiClient.instance;
            let apiKey = defaultClient.authentications['api-key'];
            apiKey.apiKey = key;

            //create content
            const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
            let sendSmtpEmail = {
              sender: {
                email: 'digihappy@mediti.fi',
                name: 'Digihappy'
              },
              to: [
                {
                  name: `${user.firstName} ${user.lastName}`,
                  email: user.email
                }
              ],
              subject: 'Digihappy Invoice',
              htmlContent: `<html lang=""><body>
                                Laskun saat täältä
                                <br/>
                                <a href="${url}">${url}</a>
                                <br/>
                                <a href="${invoice_paid.invoice_pdf}">PDF</a>
                                </body></html>`
            };

            // call SIB api
            apiInstance.sendTransacEmail(sendSmtpEmail);
          }
        } else if (invoice_paid.customer) {
          const user = await User.findOne({ where: { customerId: invoice_paid.customer } });
          if (user) {
            const url = invoice_paid.hosted_invoice_url;
            // authentication
            const key = process.env.SIB_API_KEY;
            const defaultClient = SibApiV3Sdk.ApiClient.instance;
            let apiKey = defaultClient.authentications['api-key'];
            apiKey.apiKey = key;

            //create content
            const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
            let sendSmtpEmail = {
              sender: {
                email: 'digihappy@mediti.fi',
                name: 'Digihappy'
              },
              to: [
                {
                  name: `${user.firstName} ${user.lastName}`,
                  email: user.email
                }
              ],
              subject: 'Digihappy Invoice',
              htmlContent: `<html lang=""><body>
                                Laskun saat täältä
                                <br/>
                                <a href="${url}">${url}</a>
                                <br/>
                                <a href="${invoice_paid.invoice_pdf}">PDF</a>
                                </body></html>`
            };

            // call SIB api
            apiInstance.sendTransacEmail(sendSmtpEmail);
          }
        }
        break;
      case 'invoice.payment_failed':
        // The payment failed or the customer does not have a valid payment method.
        // The subscription becomes past_due. Notify your customer and send them to the
        // customer portal to update their payment information.
        const invoice_failed = event.data.object;
        console.log('INVOICE FAILED', invoice_failed);
        break;
      // ... handle other event types

      case 'payment_intent.canceled':
        const payment_intent_canceled = event.data.object;
        console.log('PAYMENT CANCELED', payment_intent_canceled);
        break;

      case 'charge.succeeded':
        const charge = event.data.object;
        console.log('CHARGE', charge);
        break;

      default:
        console.log(`Unhandled event type ${event?.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.deliver(200, 'Success', { received: true });
  } catch (err) {
    // @ts-ignore
    console.log(err.message);
    // @ts-ignore
    next(new BadRequestError(err.message));
  }
};

export function createShipment(order: {
  id: number;
  name: string;
  mobile: string;
  city: string;
  address: string;
  postalCode: string;
  shippingMethod: string;
  usePickupPoint: boolean;
  pickupPoint: string;
  shipmentId: string;
}) {
  let data = {
    pdfConfig: {
      target1XOffset: 0,
      target1YOffset: 0,
      target1Media: 'laser-a5',
      target2XOffset: 0,
      target2YOffset: 0,
      target2Media: 'laser-a4',
      target3XOffset: 0,
      target3YOffset: 0,
      target3Media: null,
      target4XOffset: 0,
      target4YOffset: 0,
      target4Media: null
    },
    shipment: {
      orderNo: order.id,
      parcels: [
        {
          contents: '',
          copies: 1,
          packageCode: 'PKT',
          valuePerParcel: true,
          volume: 0,
          weight: 0.31
        }
      ],
      receiver: {
        address1: order.address,
        city: order.city,
        contact: order.name,
        country: 'FI',
        name: order.name,
        mobile: order.mobile,
        phone: order.mobile,
        zipcode: order.postalCode
      },
      sender: {
        phone: '045 7831 9804',
        address1: 'Otakaari 5',
        city: 'ESPOO',
        country: 'FI',
        name: 'Mediti Oy Digihappy',
        zipcode: '02150'
      },
      senderPartners: [
        {
          id: 'POSTI',
          custNo: POSTI_CUSTOMER_NUMBER
        }
      ],
      senderReference: 'MEDITI OY DIGIHAPPY',
      service: {
        id: 'PO2103',
        normalShipment: true,
        pickupBooking: false
      }
    }
  };

  if (order.usePickupPoint) {
    // @ts-ignore
    data.shipment.agent = {
      quickId: order.pickupPoint
    };
  }

  let creds = `${POSTI_USERNAME}:${POSTI_PASSWORD}`;
  let token = Buffer.from(creds).toString('base64');
  let options = {
    method: 'POST',
    url: `${posti_uri}/shipments`,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
  request(options, function (error: any, response: any) {
    console.log(error);
    if (error) throw new Error(error);

    if (response.statusCode === 201) {
      console.log(response.body);
      const resp_body = JSON.parse(response.body)[0];
      console.log(resp_body);
      // @ts-ignore
      const shipmentId = resp_body.id;
      Order.update(order.id, { shipmentId: shipmentId });
      const pdfs = resp_body.pdfs;
      pdfs.forEach((pdf1: { id: any; href: string }) => {
        const url2 = require('url').parse(pdf1.href);
        const options2 = {
          method: 'GET',
          hostname: url2.hostname,
          port: 443,
          path: url2.pathname,
          headers: {
            Authorization: `Basic ${token}`
          }
        };

        const req = https.request(options2, (response2) => {
          if (response2.statusCode === 200) {
            let sent = false;
            let chunks: any[] = [];
            response2.on('data', function (chunk) {
              console.log('start');
              chunks.push(chunk);
            });
            response2.on('end', function () {
              if (sent) return;
              const body = Buffer.concat(chunks).toString('base64');
              const file = {
                orderId: order.id,
                shipmentId: shipmentId,
                name: `${pdf1.id}.pdf`,
                content: body
              };
              sendEmail(file);
              sent = true;
            });
          }
        });
        req.on('error', (error) => {
          console.error(error);
        });
        req.end();
      });
    }
  });
}

async function sendEmail(file: any) {
  const key = process.env.SIB_API_KEY;

  // authentication
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  let apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = key;

  //create content
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  let attachs: any[] = [];
  let sendSmtpEmailAttachment = {
    name: file.name,
    content: file.content
  };
  attachs.push(sendSmtpEmailAttachment);
  let sendSmtpEmail = {
    sender: {
      email: 'digihappy@mediti.fi',
      name: 'Digihappy'
    },
    to: [
      {
        name: 'Digihappy',
        email: 'digihappy@mediti.fi'
      }
    ],
    subject: 'New shipment document',
    htmlContent: `<html><head></head><body>
        New order created
        <br/>
        Order ID:${file.orderId}
        <br/>
        Shipment ID: ${file.shipmentId}
        <br/>
        Documents are attached.
      </body></html>`,
    attachment: attachs
  };

  // call SIB api
  const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
  console.log(data);
}
