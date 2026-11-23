import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'EAraç Kiralama | Şeffaf, Güvenilir & Hızlı Araç Kiralama',
  description:
    'Sürpriz ek ücret yok, şeffaf fiyatlandırma, 2 saat hazırlık tamponu ve anında iade garantisiyle yeni nesil araç kiralama deneyimi.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="bg-[#E5EBF2] text-[#0F172A] flex flex-col min-h-screen">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
