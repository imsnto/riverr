
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/use-auth';
import FirebaseErrorListener from '@/components/FirebaseErrorListener';

export const metadata: Metadata = {
  title: 'TimeFlow',
  description: 'Project + Task + Time Tracking System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          src="https://studio--timeflow-6i3eo.us-central1.hosted.app/chatbot-loader.js"
          data-bot-id="usALDhLW8Fvmwsyaml89"
          data-hub-id="ezy7Dc0yrqY5XSPpl7Gv"
          async
        ></script>
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <AuthProvider>
          {children}
          <FirebaseErrorListener />
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
