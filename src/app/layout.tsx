import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { LoadingOverlay } from '@/components/loading-overlay';
import { ClientLayout } from '@/components/client-layout';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '英文阅读教练 | 个性化英语学习',
    template: '%s | 英文阅读教练',
  },
  description:
    '在真实阅读场景中提升英文能力。智能识别薄弱点，个性化练习，稳步提升阅读理解水平。',
  keywords: [
    '英语学习',
    '英文阅读',
    '英语练习',
    '阅读理解',
    '词汇学习',
    '翻译练习',
    '英语工具',
  ],
  authors: [{ name: 'English Reading Coach' }],
  generator: 'Coze Code',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased min-h-screen bg-[var(--background)]`} suppressHydrationWarning>
        <ClientLayout>
          {isDev && <Inspector />}
          {children}
          <LoadingOverlay />
        </ClientLayout>
      </body>
    </html>
  );
}
