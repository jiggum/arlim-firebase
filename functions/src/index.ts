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
    Object.values(alarms).forEach(async ({
      schedule,
      month,
      day,
      hour,
      minutes,
      date,
      message,
      token,
    }: any) => {
      if(token) {
        const target = new Date(date)
        let body = ''

        switch (schedule) {
          case 'everyWeek':
          case 'today':
            body = `${hour.padStart(2, 0)}:${minutes.padStart(2, 0)}`
            break
          case 'tomorrow':
          case 'thisYear':
          case 'nextYear':
            body = `${hour.padStart(2, 0)}:${minutes.padStart(2, 0)} ${month}/${day}/${target.getFullYear()}`
            break
          default:
            throw Error(`Invalid schedule: ${schedule}`)
        }

        const payload = {
          notification: {
            title: message,
            body,
            icon: 'https://s3.ap-northeast-2.amazonaws.com/arl.im/android-chrome-192x192.png',
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
