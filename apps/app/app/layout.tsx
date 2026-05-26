import "./globals.css";

export const metadata = {
  title: "Vooster",
  description: "Read-only spec review"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
