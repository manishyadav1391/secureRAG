import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/components/AuthProvider'

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SecurRAG — Internal Knowledge Base",
  description: "AI-powered internal document Q&A chatbot with role-based access control. Ask questions about company policies, procedures, and documents securely.",
  keywords: ["knowledge base", "chatbot", "RAG", "internal documents", "AI assistant"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
