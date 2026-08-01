/**
 * Canonical product-type derivation.
 *
 * The filter sidebar needs a "Type" facet, but no single feed column provides
 * one. `product_type` is a retailer breadcrumb (884 distinct values, populated
 * for ~36% of PROD and ~95% of the raw feed) and the rest have to come from the
 * product name.
 *
 * Signal order, most specific first:
 *   1. last segment of the `product_type` breadcrumb
 *   2. the whole breadcrumb
 *   3. product_name
 *
 * The last segment leads because full paths carry misleading ancestors:
 * "Sofas > Chairs > Beige Chair > Beige Fabric Chair > Recliner Chair" is a
 * recliner, not a sofa, and "Black Leather 3 Seater Sofas" would otherwise
 * match on colour and material words.
 */

type Rule = readonly [label: string, pattern: RegExp];

/**
 * Lighting and furniture are matched against separate rule sets, chosen by
 * context. Lighting product names are full of furniture words — "under-cabinet
 * lamp", "LED mirror light", "Desk Battery Lamp", "buffet lamp" — and a single
 * flat rule list types those as Cabinet / Mirror / Desk / Sideboard.
 */
export const LIGHTING_RULES: readonly Rule[] = [
  ['Light Bulb', /\b(bulb|bulbs|led lamp|filament)\b/i],
  [
    'Outdoor Light',
    /\b(outdoor light|garden light|bollard|stake light|string light|festoon|solar light)/i,
  ],
  ['Lamp Shade', /\b(lamp\s*shade|shade)s?\b/i],
  ['Spotlight', /\b(spot\s*light|spotlight|downlight|spots)\b/i],
  ['Wall Light', /\b(wall\s*light|wall\s*lamp|sconce|picture light)/i],
  ['Floor Lamp', /\b(floor\s*lamp|floor\s*light|uplighter)/i],
  ['Table Lamp', /\b(table\s*lamp|desk\s*lamp|bedside lamp|touch lamp)/i],
  ['Pendant Light', /\b(pendant|chandelier|suspension)/i],
  ['Ceiling Light', /\b(ceiling|flush\s*mount|batten)/i],
  ['Light', /\b(light|lamp|luminaire)/i], // generic fallback
];

export const FURNITURE_RULES: readonly Rule[] = [
  // Beds & bedroom
  ['Divan Bed', /\bdivan/i],
  ['Mattress', /\bmattress/i],
  ['Headboard', /\bheadboard/i],
  ['Bed Frame', /\b(bed\s*frame|bedstead|bunk bed|ottoman bed|guest bed|day\s*bed)/i],
  ['Bedside Table', /\b(bedside|nightstand)/i],

  // Seating — specific before general: Corner Sofa before Sofa, Bar Stool
  // before Stool, and the bare "Chair" catch-all last in the block.
  ['Sofa Bed', /\b(sofa\s*bed|sofabed|futon)/i],
  ['Corner Sofa', /\b(corner sofa|corner group|l\s*shape|chaise)/i],
  ['Recliner', /\brecliner|reclining/i],
  ['Bean Bag', /\bbean\s*bag/i],
  ['Bar Stool', /\b(bar stool|breakfast stool|counter stool|kitchen stool|gas lift)/i],
  ['Footstool', /\b(footstool|foot stool|pouffe|ottoman|banquette)/i],
  ['Office Chair', /\b(office chair|desk chair|gaming chair|task chair|computer chair|kneeling chair)/i],
  ['Dining Chair', /\b(dining chair|kitchen chair)/i],
  ['Garden Chair', /\b(garden chair|patio chair|sun lounger|deck chair|egg chair|hanging chair)/i],
  [
    'Armchair',
    /\b(armchair|arm chair|accent chair|occasional chair|tub chair|wing chair|snuggle|bedroom chair|swivel chair)/i,
  ],
  ['Bench', /\bbench/i],
  ['Sofa', /\b(sofa|settee|couch|loveseat|sofa set)/i],
  ['Stool', /\bstool/i],
  ['Chair', /\bchair/i],

  // Tables & desks
  ['Coffee Table', /\bcoffee table/i],
  ['Console Table', /\bconsole/i],
  ['Side Table', /\b(side table|end table|lamp table|occasional table)/i],
  ['Dressing Table', /\bdressing table/i],
  ['Dining Table', /\b(dining table|dining set|kitchen table|table (and|&) chair)/i],
  ['Bar Table', /\b(bar table|bistro table|poseur)/i],
  ['Desk', /\bdesk/i],
  ['Table', /\btable/i],

  // Storage
  ['Wardrobe', /\bwardrobe|armoire/i],
  ['Chest of Drawers', /\b(chest of drawers|drawer chest|tallboy|drawers)/i],
  ['Sideboard', /\b(sideboard|buffet|dresser|display cabinet)/i],
  ['TV Unit', /\b(tv unit|tv stand|media unit|entertainment unit)/i],
  ['Bookcase', /\b(bookcase|bookshelf)/i],
  ['Shelving', /\b(shelving|shelf|shelves|wall unit)/i],
  ['Shoe Storage', /\bshoe (storage|rack|cabinet)/i],
  ['Storage Box', /\b(storage box|storage basket|storage bag|decorative storage|trunk|blanket box)/i],
  ['Cabinet', /\b(cabinet|cupboard|larder)/i],
  ['Storage', /\bstorage/i],

  // Outdoor
  ['Parasol', /\b(parasol|umbrella|gazebo|awning)/i],
  [
    'Garden Furniture',
    /\b(garden (dining|furniture|set)|patio set|rattan set|outdoor (dining|furniture))/i,
  ],

  // Soft furnishings & decor
  ['Cushion', /\b(cushion|pillow|bolster)/i],
  ['Rug', /\b(rug|carpet|runner|door\s*mat)/i],
  ['Mirror', /\bmirror/i],
  ['Curtain', /\b(curtain|blind|voile)/i],

  // Plants
  ['Planter', /\b(planter|plant pot|flower pot|window box)/i],
  [
    'Artificial Plant',
    /\b(artificial (plant|tree|flower)|faux plant|plant|tree|bouquet|succulent|orchid)/i,
  ],
];

/**
 * Names specific enough to outrank the breadcrumb.
 *
 * Normally the breadcrumb wins, because it is the retailer's own
 * classification. But retailers file sofa beds under generic bed categories —
 * "Home & Garden > Beds > Guest Beds", "... > Bed Frames" — which types 63 of
 * them as Bed Frame and lands sofa beds in the Bed category. "Sofa bed" in a
 * product name is unambiguous in a way those breadcrumbs are not.
 */
const NAME_OVERRIDES: readonly Rule[] = [['Sofa Bed', /\bsofa\s*bed\b/i]];

const LIGHTING_MERCHANTS = new Set(['lights.co.uk', 'lights.ie']);
const LIGHTING_CONTEXT = /light|lamp|bulb|luminaire|lighting/i;

export function isLightingProduct(
  merchant?: string | null,
  category?: string | null,
  merchantCategory?: string | null,
  productType?: string | null,
): boolean {
  if (LIGHTING_MERCHANTS.has((merchant || '').trim().toLowerCase())) return true;
  // Only the LAST breadcrumb segment counts here. Retailers file plants and
  // decor under paths like "Home Furnishings & Lighting > Vases & Artificial
  // Plants" — matching the whole path types 400 artificial plants as lights.
  const lastSegment = (productType || '').split('>').pop() || '';
  return LIGHTING_CONTEXT.test(`${category || ''} ${merchantCategory || ''} ${lastSegment}`);
}

function matchRules(text: string, rules: readonly Rule[]): string | null {
  if (!text) return null;
  for (const [label, pattern] of rules) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function deriveProductType(
  productType?: string | null,
  productName?: string | null,
  merchant?: string | null,
  category?: string | null,
  merchantCategory?: string | null,
): string | null {
  const rules = isLightingProduct(merchant, category, merchantCategory, productType)
    ? LIGHTING_RULES
    : FURNITURE_RULES;

  const name = (productName || '').trim();
  if (rules === FURNITURE_RULES) {
    const override = matchRules(name, NAME_OVERRIDES);
    if (override) return override;
  }

  const breadcrumb = (productType || '').trim();
  if (breadcrumb) {
    const last = (breadcrumb.split('>').pop() || '').trim();
    const fromLast = matchRules(last, rules);
    if (fromLast) return fromLast;

    const fromPath = matchRules(breadcrumb, rules);
    if (fromPath) return fromPath;
  }

  return matchRules((productName || '').trim(), rules);
}
