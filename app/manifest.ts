import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DeliveryHub',
    short_name: 'DeliveryHub',
    description: 'A solução SaaS completa para o seu negócio de delivery.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1fb6e5',
    icons: [
      {
        src: '/logo.png?v=3',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/logo.png?v=3',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png?v=3',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
