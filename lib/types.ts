import { Timestamp } from 'firebase/firestore';

export interface NoteReminder {
  id: string;
  date: Timestamp;
  label?: string;
  notified?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  reminder?: Timestamp | null;
  reminders?: NoteReminder[];
  expiryDate?: Timestamp | null;
  isBookmarked: boolean;
  isCompleted?: boolean;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  embedding?: number[];
  isTemporary?: boolean;
  expiresAt?: number | null;
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
