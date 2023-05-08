import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import User from '../entities/User.postgres';
import { InternalServerError } from '../helpers/apiError';
// import { server_uri } from '../utils/secrets';
import Order from '../entities/Order.postgres';

const SibApiV3Sdk = require('sib-api-v3-sdk');
// const sendinBlue = require('nodemailer-sendinblue-transport')

export const transporter = nodemailer.createTransport({
  service: 'Sendinblue',
  auth: {
    user: process.env.EMAIL_LOGIN,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Reset password email
export const getPasswordResetURL = (user: any, token: any) => `"${'server_uri'}"/password/reset/${user.id}/${token}`;

export const resetPasswordTemplate = (user: any, url: any) => {
  const from = process.env.EMAIL_LOGIN;
  const to = user.email;
  const subject = 'Uuden salasanan luominen  / vanhan salasanan vaihtaminen';
  const html = `
  <p>Hei ${user.firstName || user.email},</p>
  <p>Klikkaa linkkiä vaihtaaksesi salasanan:</p>
  <a href=${url}>${url}</a>
  <p>Linkki vanhenee tunnin sisällä.</p>
  `;

  return { from, to, subject, html };
};

// sign jwt using dynamic payload and secret key
export const usePasswordHashToMakeToken = ({ password: hashedPassword, id: userId, createdAt }: any) => {
  const secret = hashedPassword + '-' + createdAt;
  return jwt.sign({ userId }, secret, {
    expiresIn: 3600
  });
};

// Sendinblue on the route '/reset-password/user/:email' emails user a url containing the token
export const sendPasswordResetEmail = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = req.params;
  let user;
  try {
    user = await User.findOne({ username });
  } catch (err) {
    res.status(404).json('No user with that email');
  }
  // signed jwt
  const token = usePasswordHashToMakeToken(user);
  const url = getPasswordResetURL(user, token);
  console.log(url);
  const emailTemplate = resetPasswordTemplate(user, url);
  const sendEmail = () => {
    transporter.sendMail(emailTemplate, (err, info) => {
      if (err) {
        return next(new InternalServerError());
      }
      console.log('Email sent', info.response);
    });
  };
  sendEmail();
};

// decode token using secret key, hash new password and replace old hash
export const receiveNewPassword = (req: Request, res: Response) => {
  const { userId, token } = req.params;
  console.log(userId, token);
  const { password } = req.body;

  User.findOne({ where: { id: userId } })
    .then((user) => {
      console.log(user?.username);
      const secret = user?.password + '-' + user?.createdAt;
      //@ts-ignore
      const payload = jwt.decode(token, secret);
      console.log(payload);
      if (payload?.userId === user?.id) {
        bcrypt.genSalt(10, function (err, salt) {
          // Call error-handling middleware:
          if (err) return;
          bcrypt.hash(password, salt, function (err, hash) {
            console.log('ERROR', err);
            // Call error-handling middleware:
            if (err) return;
            User.findOne({ where: { id: userId, password: hash } });
            User.update(userId, { password: hash })
              .then(() => res.deliver(202, 'Password changed successfully'))
              //@ts-ignore
              .catch((err: any) => res.deliver(500, err));
          });
        });
      }
    })
    .catch(() => {
      res.deliver(404, 'Invalid user');
    });
};

//send email to member
export const sendEmailCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.body.email;
    const name = req.body.name;
    // @ts-ignore
    const user_id = req.user.id;
    console.log(user_id);

    const orders = await Order.find({ relations: ['user'], where: { user: { id: user_id }, ready: null } });
    console.log(orders);

    if (orders?.length) {
      const key = process.env.SIB_API_KEY;

      // authentication
      const defaultClient = SibApiV3Sdk.ApiClient.instance;
      let apiKey = defaultClient.authentications['api-key'];
      apiKey.apiKey = key;

      //create content
      const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      let sendSmtpEmail = {
        sender: {
          name: 'Digihappy',
          email: 'digihappy@mediti.fi'
        },
        to: [
          {
            email: email,
            name: name
          }
        ],
        // @ts-ignore
        templateId: parseInt(process.env.SENDINBLUE_TEMPLATE_ID_ORDER_DONE)
      };

      for (const order of orders) {
        console.log(order.id);
        await Order.update(order.id, { ready: new Date() });
      }

      // call SIB api
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('API called successfully. Returned data: ' + data);
      res.deliver(200, 'Success', data);
    } else {
      res.deliver(200, 'Success', {});
    }
  } catch (error) {
    console.log(error);
    next(new InternalServerError());
  }
};

//send email to member
export const sendEmailMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.body.email;
    const name = req.body.name;

    const key = process.env.SIB_API_KEY;

    // authentication
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    let apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = key;

    //create content
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); // SendSmtpEmail | Values to send a transactional email
    sendSmtpEmail = {
      sender: {
        name: 'Digihappy',
        email: 'digihappy@mediti.fi'
      },
      to: [
        {
          email: email,
          name: name
        }
      ],
      subject: 'Läheisesi lisäsi sinut perhetiliin, täydennä tietosi!',
      htmlContent: `<html><head></head><body><h1>Hei ${name}!</h1>
      <strong><p>Läheisesi on lisännyt sinut Digihappy-perheeseen. 
      Digihappy on senioritablettipalvelu, jonka avulla koko perhe voi 
      pitää yhteyttä hoivakodissa asuvaan läheiseenne.</strong>
      <p><strong>Ottaaksesi palvelun käyttöön sinun tulee täydentää oman 
      tilisi tiedot. Voit tehdä sen kirjautumalla osoitteeseen 
      https://digihappy.fi. Salasanasi on ${name}-läheinen. 
      Vaihda salasana sivustolla heti ensimmäisen kirjautumisen jälkeen.</p></strong>
      
      <h2>Digihappy Senioritabletti</h2>
      <p>Digihappy Senioritabletti yhdistää perheen ja tuo digin jokaiselle 
      toimintakyvystä huolimatta. Palveluumme kuuluu senioriystävälliseksi muokattu 
      Samsung-tabletti, jalusta ja nettiliittymä. Tabletin ominaisuudet ja sovellukset 
      on muokattu seniorin toimintakyvyn mukaan. Yhteydenpitoa helpottaa videopuhelu 
      isolla näytöllä ja tarvittaessa automaattisella vastaustoiminnolla.</p>
      <p>Tabletti on käyttöönottovalmis ja sinne on viety perhetilin läheisten yhteystiedot. 
      Palveluun sisältyy käyttöönottoneuvonta, etähallinta ja it-tuki.</p>

      <h2>Perhetili</h2>
      <p>Kysymme Skype-yhteystietojasi mahdollistaaksemme sujuvat ja helpot 
      videopuhelut seniorin kanssa. Mikäli sinulla ei ole vielä Skype-tiliä, 
      voit luoda sen täällä. Ohjeet Skype-tilin luomiseen löydät täältä. 
      Jatkossa mahdollistamme entistäkin laajemmat videotoiminnallisuudet oman 
      sovelluksemme kautta.</p>
      <p>Digihappy perhetilin jäsenenä sinun yhteystietosi viedään valmiiksi 
      seniorin tablettiin. Kun soitat seniorille, videopuhelu avautuu automaattisesti.</p>

      <h2>Mitä seuraavaksi tapahtuu?</h2>
      <p>Kun kaikki läheiset ovat täyttäneet yhteystietonsa, tallennamme 
      ne tablettiin. Asennamme tablettiin valmiiksi oikeat asennukset ja senioria kiinnostavat, 
      helppokäyttöiset sovellukset. Kun tabletti on valmis, toimitamme sen 
      suoraan hoivakotiin. Perehdytämme seniorin, hoitajat ja palvelun 
      tilanneen läheisen käyttämään Digihappy-senioritablettia.</p>

      <h2>Lue lisää ja kysy!</h2>
      <p>Lisätietoja palvelusta löydät nettisivuiltamme osoitteesta 
      https://digihappy.fi. Katso myös lyhyt demovideomme täältä: https://www.youtube.com/watch?v=b2Asf6MG4uo.</p>
      <p>Mikäli kysymyksiä herää, Digihappyn asiakaspalvelu auttaa mielellään. 
      Tavoitat meidät sähköpostitse osoitteesta katri.niemi@mediti.fi. 
      Voit myös soittaa tai lähettää WhatsApp-viestin Katrille numeroon 045 7831 9804.</p>

      <p>Ihania hetkiä Digihappy Senioritabletin parissa!</p>
      <p>Aurinkoisin terveisin, Digihappy-tiimi</p>
      </body></html>`,

      headers: {
        'X-Mailin-custom':
          'custom_header_1:custom_value_1|custom_header_2:custom_value_2|custom_header_3:custom_value_3',
        charset: 'iso-8859-1'
      }
    };

    // call SIB api
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('API called successfully. Returned data: ' + data);
    res.deliver(200, 'Success', data);
  } catch (error) {
    console.log(error);
    next(new InternalServerError());
  }
};

// contact email
// export const contactEmail = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { email, name, text } = req.body
//
//     const auth = {
//       auth: {
//         apiKey: process.env.SIB_API_KEY,
//         // TODO: get
//         domain: 'domain from sendinblue/aws?',
//       },
//     }
//
//     const transporter = nodemailer.createTransport(sendinBlue(auth))
//
//     let sendMail = (cb: any) => {
//       const mailOptions = {
//         sender: name,
//         from: email,
//         to: 'tiina.leivo@mediti.fi',
//         subject: 'Yhteydenotto Digihappy',
//         text: text,
//       }
//       transporter.sendMail(mailOptions, function (error, data) {
//         if (error) {
//           cb(error, null)
//         } else {
//           cb(null, data)
//         }
//       })
//     }
//     res.deliver(200, 'Success', sendMail)
//   } catch (error) {
//     next(new InternalServerError())
//   }
// }

//send email to member
export const contactEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, text } = req.body;

    const key = process.env.SIB_API_KEY;

    // authentication
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    let apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = key;

    //create content
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); // SendSmtpEmail | Values to send a transactional email
    sendSmtpEmail = {
      sender: {
        email: email,
        name: name
      },
      to: [
        {
          name: 'Digihappy',
          email: 'digihappy@mediti.fi'
        }
      ],
      subject: 'Yhteydenotto Digihappy',
      htmlContent: `<html><head></head><body>
        ${text}
      </body></html>`,

      headers: {
        'X-Mailin-custom':
          'custom_header_1:custom_value_1|custom_header_2:custom_value_2|custom_header_3:custom_value_3',
        charset: 'iso-8859-1'
      }
    };

    // call SIB api
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('API called successfully. Returned data: ' + data);
    res.deliver(200, 'Success', data);
  } catch (error) {
    next(new InternalServerError());
  }
};
