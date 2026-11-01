import type { Metadata } from 'next';
import { AccountPanel } from '@/components/account/account-panel';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default function AccountPage() {
  return (
    <Container className="max-w-xl py-10">
      <AccountPanel />
    </Container>
  );
}
