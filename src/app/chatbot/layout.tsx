
import '../globals.css';
import { Toaster } from "@/components/ui/toaster"

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased bg-transparent">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
