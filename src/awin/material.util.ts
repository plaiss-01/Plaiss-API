/**
 * Material derivation ("Product Type" in Raphael's field spec: Fabric,
 * Leather, wood, metal...).
 *
 * Measured against production before building: product_name alone covers
 * 38.4% of the catalogue, adding merchant_category 38.5%, adding the
 * DESCRIPTION 70.7% - the description is what makes this field viable, so
 * it is part of the signal set despite being noisier.
 *
 * Signal order: product_name -> merchant_category -> description. The name
 * is what the retailer chose to lead with ("Aztec Plush Velvet 3 Seater
 * Sofa"); the description often lists frame materials too ("oak legs"), so
 * it only gets a say when the stronger signals are silent.
 *
 * Within one text, rules run in the order below: upholstery materials before
 * frame materials, so "velvet sofa with oak legs" is Velvet, not Wood.
 * Specific fabrics (Velvet, Boucle, Chenille, Linen) outrank the generic
 * Fabric label. "Faux/PU/bonded leather" counts as Leather - that is how
 * shoppers filter.
 */

const MATERIAL_RULES: Array<[string, RegExp]> = [
  ['Leather', /\b(?:leather|leatherette)\b/i],
  ['Velvet', /\bvelvets?\b|\bplush velvet\b/i],
  ['Boucle', /\bboucl[eé]\b/i],
  ['Chenille', /\bchenille\b/i],
  ['Linen', /\blinen\b/i],
  ['Fabric', /\b(?:fabric|upholstered|tweed|textile|polyester weave)\b/i],
  ['Marble', /\bmarble\b/i],
  ['Glass', /\bglass\b/i],
  ['Rattan', /\b(?:rattan|wicker|cane)\b/i],
  [
    'Wood',
    /\b(?:wood|wooden|oak|walnut|pine|teak|acacia|mango wood|beech|birch|ash wood|solid ash|mdf|plywood|veneer)\b/i,
  ],
  [
    'Metal',
    /\b(?:metal|steel|stainless|wrought iron|cast iron|chrome|brass|aluminium|aluminum|copper|brushed nickel)\b/i,
  ],
];

function matchMaterial(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [label, pattern] of MATERIAL_RULES) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function deriveMaterial(
  productName: string | null | undefined,
  merchantCategory: string | null | undefined,
  description: string | null | undefined,
): string | null {
  return (
    matchMaterial(productName) ||
    matchMaterial(merchantCategory) ||
    matchMaterial(description)
  );
}
