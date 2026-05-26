import "./globals.css";

export const metadata = {
  title: "Vooster",
  description: "읽기 전용 명세 리뷰"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
