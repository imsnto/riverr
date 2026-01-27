// src/app/hc/[hcId]/layout.tsx
export default function HelpCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* We can add a shared header/footer here later if needed */}
      {children}
    </div>
  );
}
