import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mente+ Segundo Cérebro',
    short_name: 'Mente+',
    description: 'Seu segundo cérebro digital inteligente para notas e conexões neurais.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fcfcf9',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
