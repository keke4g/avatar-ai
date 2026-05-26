import "./globals.css";

export const metadata = {
  title: "Avatar AI",
  description: "Asistente IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}