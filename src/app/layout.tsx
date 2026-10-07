import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { PageScrollbar } from '@/components/page-scrollbar';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

import { Providers } from './providers';
import './globals.css';

const fontSans = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
const fontMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-mono', preload: false });

export const metadata: Metadata = {
  title: 'Переговорка — бронирование',
  description: 'Бронирование переговорной комнаты на рабочий день',
};

// Matches --background in globals.css.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ru" suppressHydrationWarning className={cn('antialiased', fontSans.variable, fontMono.variable)}>
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
          <PageScrollbar />
        </ThemeProvider>
      </body>
    </html>
  );
}
