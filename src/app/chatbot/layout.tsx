
import '../globals.css';
import { Toaster } from "@/components/ui/toaster"

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark font-body antialiased bg-transparent" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
