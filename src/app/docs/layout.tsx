
import '../globals.css';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        {children}
      </div>
    </div>
  );
}
