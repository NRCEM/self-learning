import { LanguageProvider } from './components/language-provider';
import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';
export const metadata: Metadata = { title: 'self-learning — Learn actively', description: 'Turn PDFs into topic-based lessons, videos and quizzes.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>; }
