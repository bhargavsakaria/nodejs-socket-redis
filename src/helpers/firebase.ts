import * as admin from 'firebase-admin';
import { DataMessagePayload, MessagingOptions, MessagingPayload } from 'firebase-admin/lib/messaging/messaging-api';

class FirebaseConfigInitializer {
  constructor(public fireAdminInstant?: Record<string, any> | Array<any>) {}

  async init() {
    // @ts-ignore
    const firebaseConfig = await import(`../../firebase-adminsdk.json`);

    const firebaseParams = {
      type: firebaseConfig.type,
      projectId: firebaseConfig.project_id,
      privateKeyId: firebaseConfig.private_key_id,
      privateKey: firebaseConfig.private_key,
      clientEmail: firebaseConfig.client_email,
      clientId: firebaseConfig.client_id,
      authUri: firebaseConfig.auth_uri,
      tokenUri: firebaseConfig.token_uri,
      authProviderX509CertUrl: firebaseConfig.auth_provider_x509_cert_url,
      clientC509CertUrl: firebaseConfig.client_x509_cert_url
    };

    this.fireAdminInstant = admin.initializeApp({
      credential: admin.credential.cert(firebaseParams)
    });

    console.log('************ Firebase-Initialized ************', this.fireAdminInstant.name);
  }

  sendNotification(token: string, payload: MessagingPayload, options?: MessagingOptions) {
    console.log('>>>>>TOKEN:', token);

    admin
      .messaging()
      .sendToDevice(token, payload, options)
      .then((response) => {
        console.log('>>>>>>>>>>>>>>>>>>> FIREBASE MESSAGE RESPONSE: ', response);
      })
      .catch((error) => {
        console.log('>>>>>>>>>>>>>>>>>>> FIREBASE MESSAGE ERROR:', error);
      });
  }
}

export default new FirebaseConfigInitializer();
