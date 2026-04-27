import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function GET(req: Request) {
  // Check for authorization (e.g., Vercel Cron Secret)
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    
    // 1. Fetch pending reminders that haven't been notified
    const notesSnapshot = await adminDb.collection('notes')
      .where('reminder', '<=', admin.firestore.Timestamp.fromDate(now))
      .where('notified', '==', false)
      .get();

    if (notesSnapshot.empty) {
      return NextResponse.json({ message: 'No pending reminders' });
    }

    const results = [];

    for (const noteDoc of notesSnapshot.docs) {
      const note = noteDoc.data();
      const userId = note.userId;

      // 2. Get user push tokens
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const tokens = userData?.pushTokens || [];

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: `Lembrete: ${note.title || 'Nota sem título'}`,
            body: 'Você tem um pensamento agendado para agora.',
          },
          data: {
            url: `${process.env.APP_URL || 'http://localhost:3000'}/?note=${noteDoc.id}`,
            noteId: noteDoc.id
          },
          tokens: tokens,
        };

        // 3. Send notifications
        const response = await admin.messaging().sendEachForMulticast(message);
        
        // 4. Update note as notified
        await noteDoc.ref.update({ notified: true });
        
        results.push({
          noteId: noteDoc.id,
          successCount: response.successCount,
          failureCount: response.failureCount
        });
      } else {
        // Mark as notified anyway or skip? 
        // Better to mark as notified to avoid infinite loops if user has no tokens
        await noteDoc.ref.update({ notified: true });
        results.push({ noteId: noteDoc.id, status: 'No tokens' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
