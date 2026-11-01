import { CreditCardIcon, StoreIcon, TagIcon } from 'lucide-react';
import { BENEFITS } from '@/lib/site';

const ICONS = { pago: CreditCardIcon, mayorista: TagIcon, retiro: StoreIcon } as const;

export function BenefitsStrip() {
  return (
    <ul className="grid gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 md:grid-cols-3 md:gap-0 md:divide-x">
      {BENEFITS.map(({ id, title, text }) => {
        const Icon = ICONS[id];
        return (
          <li key={id} className="flex items-center gap-3 md:px-6">
            <Icon className="size-7 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
