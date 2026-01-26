
import '../globals.css';
import { Toaster } from "@/components/ui/toaster"

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-body antialiased bg-transparent" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
