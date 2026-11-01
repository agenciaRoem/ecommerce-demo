import type { Metadata } from 'next';
import { Dashboard } from '@/components/backoffice/dashboard';

export const metadata: Metadata = { title: 'Resumen' };

export default function AdminHomePage() {
  return <Dashboard />;
}
