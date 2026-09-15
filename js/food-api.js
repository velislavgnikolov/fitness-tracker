export async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Мрежова грешка');
  const data = await res.json();
  const products = data.products || [];

  return products
    .filter((p) => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] != null)
    .map((p) => ({
      name: p.product_name,
      brand: p.brands || '',
      unit: 'g',
      kcal100: round1(p.nutriments['energy-kcal_100g']),
      protein100: round1(p.nutriments['proteins_100g'] || 0),
      carbs100: round1(p.nutriments['carbohydrates_100g'] || 0),
      fat100: round1(p.nutriments['fat_100g'] || 0),
      source: 'off',
    }))
    .slice(0, 15);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
