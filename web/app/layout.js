import Link from 'next/link';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
import './globals.css';

export const metadata = {
  title: 'TapCheck: community water reports',
  description: 'Report tap water and sanitation problems. Not a substitute for official water testing.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <strong>TapCheck</strong>
          <Link href="/report">Report</Link>
          <Link href="/map">Map</Link>
          <Link href="/dashboard">Status</Link>
        </header>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
