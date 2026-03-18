import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tuition Manager',
  description: 'Tuition Manager dashboard and parent portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
