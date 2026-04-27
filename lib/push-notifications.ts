import { messaging, db } from './firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(userId: string) {
  if (typeof window === 'undefined') return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messagingInstance = await messaging;
      if (!messagingInstance) return null;

      const token = await getToken(messagingInstance, {
        vapidKey: VAPID_KEY
      });

      if (token) {
        // Save token via API route
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, token })
        });
        return token;
      }
    }
  } catch (error) {
    console.error('Error getting push token:', error);
  }
  return null;
}
