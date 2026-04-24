import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const viewport = {
  themeColor: '#fcfcf9',
};

export const metadata: Metadata = {
  title: 'Mente+ Segundo Cérebro',
  description: 'Seu segundo cérebro digital inteligente.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mente+',
  },
  formatDetection: {
    telephone: false,
  },
};

import SpecialistChat from '@/components/SpecialistChat';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} ${cormorant.variable}`}>
      <body suppressHydrationWarning className="bg-[#fcfcf9] text-[#1a1a1a] font-sans antialiased">
        {children}
        <SpecialistChat />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
