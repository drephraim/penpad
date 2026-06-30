import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
  title: 'PenPad | AI-Powered Writing',
  description: 'Write, auto-save, and perfect your grammar with AI-powered suggestions. A minimal, premium notepad.',
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
}

import Providers from '@/components/Providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable}`}>
        <Providers>
          {children}
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.getRegistrations()
                    .then(function(registrations) {
                      return Promise.all(registrations.map(function(registration) {
                        return registration.unregister();
                      }));
                    })
                    .then(function() {
                      if ('caches' in window) {
                        return caches.keys().then(function(keys) {
                          return Promise.all(keys.map(function(key) {
                            return key.indexOf('penpad-') === 0 ? caches.delete(key) : Promise.resolve(false);
                          }));
                        });
                      }
                    })
                    .catch(function(err) {
                      console.warn('Service worker cleanup failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
