import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const { userId, token } = await req.json();

    if (!userId || !token) {
      return NextResponse.json({ error: 'Missing userId or token' }, { status: 400 });
    }

    // Save token to Firestore using Admin SDK
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.set({
      pushTokens: FieldValue.arrayUnion(token),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in subscribe route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
