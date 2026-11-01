import { Suspense } from 'react';
import { BenefitsStrip } from '@/components/store/benefits-strip';
import { CategorySections } from '@/components/store/category-sections';
import { CategoryStrip, CategoryStripSkeleton } from '@/components/store/category-strip';
import { Container } from '@/components/store/container';
import { HeroCarousel } from '@/components/store/hero-carousel';
import { ProductSection, ProductSectionSkeleton } from '@/components/store/product-section';
import { PromoBanners } from '@/components/store/promo-banners';

export default function HomePage() {
  return (
    <Container className="space-y-8 py-4 md:space-y-10 md:py-6">
      <HeroCarousel />
      <BenefitsStrip />

      <Suspense fallback={<CategoryStripSkeleton />}>
        <CategoryStrip />
      </Suspense>

      <Suspense fallback={<ProductSectionSkeleton />}>
        <ProductSection title="Nuestros productos elegidos para vos" filters={{ sort: 'newest' }} href="/productos" />
      </Suspense>

      <Suspense fallback={<ProductSectionSkeleton tone="brand" />}>
        <ProductSection title="Ofertas únicas" tone="brand" filters={{ onSale: true }} href="/productos?onSale=true" />
      </Suspense>

      <PromoBanners />

      <Suspense fallback={<ProductSectionSkeleton />}>
        <CategorySections />
      </Suspense>
    </Container>
  );
}
