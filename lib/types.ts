import { Timestamp } from 'firebase/firestore';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  reminder?: Timestamp | null;
  expiryDate?: Timestamp | null;
  isBookmarked: boolean;
  isCompleted?: boolean;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  embedding?: number[];
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
