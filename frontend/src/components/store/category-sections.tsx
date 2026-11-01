import { fetchCategories } from '@/lib/store-api';
import { ProductSection } from './product-section';

const MAX_SECTIONS = 2;
const MIN_PRODUCTS = 4;

/** "Nuestros elegidos en …" para las categorías con más productos. */
export async function CategorySections() {
  const categories = (await fetchCategories())
    .filter((category) => category.productCount >= MIN_PRODUCTS)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, MAX_SECTIONS);

  return (
    <>
      {categories.map((category) => (
        <ProductSection
          key={category.id}
          title={`Nuestros elegidos en ${category.name}`}
          filters={{ category: category.slug }}
          href={`/productos?category=${category.slug}`}
        />
      ))}
    </>
  );
}
