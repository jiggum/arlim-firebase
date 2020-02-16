import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp(functions.config().firebase);

export const noti = functions
  .region('asia-east2')
  .pubsub
  .topic('noti')
  .onPublish(async () => {
    const jobInterval = 60 * 1000
    const now = new Date()
    const currentTimeStamp = now.getTime() - (now.getTime() % jobInterval)
    const time = currentTimeStamp % (24 * 60 * 60 * 1000)
    const db = admin.firestore();

    const alarms: any = {}
    try {
      const dateAlarms = await db.collection('alarms')
        .where('date', '>=', currentTimeStamp)
        .where('date', '<', currentTimeStamp + jobInterval)
        .get()
      const dayAlarms = await db.collection('alarms')
        .where('days', 'array-contains', now.getDay())
        .where('time', '>=', time < jobInterval ? 0 : time)
        .where('time', '<', time + jobInterval)
        .get()

      dateAlarms.forEach(doc => {
        alarms[doc.id] = doc.data()
      })
      dayAlarms.forEach(doc => {
        alarms[doc.id] = doc.data()
      })
    } catch(e) {
      console.log('Error getting documents', e);
    }

    console.log(alarms)
    Object.values(alarms).forEach(async ({ token, message }: any) => {
      if(token) {
        const payload = {
          notification: {
            title: message,
            body: '10:00',
            click_action: 'https://arl.im',
          }
        }
        try {
          const response = await admin.messaging().sendToDevice(token, payload)
          response.results.forEach((result) => {
            const error = result.error;
            if (error) {
              console.error('FCM failure :', error.code);
            } else {
              console.log('FCM success');
            }
          });
        } catch (e) {
          console.log('Failed sendToDevice: ', e);
        }
      }
    })

    return 0
  })
