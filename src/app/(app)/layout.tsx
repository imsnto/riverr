// This layout applies the dark theme to the main authenticated part of the app.
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return <div className="dark h-full">{children}</div>;
}
