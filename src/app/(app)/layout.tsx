// This layout applies the dark theme to the main authenticated part of the app.
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return <div className="h-full">{children}</div>;
}
