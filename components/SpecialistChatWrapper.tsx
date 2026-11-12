'use client';

import dynamic from 'next/dynamic';

const SpecialistChat = dynamic(() => import('@/components/SpecialistChat'), {
  ssr: false,
});

export default function SpecialistChatWrapper() {
  return <SpecialistChat />;
}
