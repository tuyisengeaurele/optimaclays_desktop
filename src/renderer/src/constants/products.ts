export interface ProductSpec {
  code: string;
  name: string;
  dimensions: string;
  application: string;
  description: string;
}

export const PRODUCTS: Record<string, ProductSpec> = {
  BRICK_10: {
    code: 'BRICK_10',
    name: 'Brick 10',
    dimensions: '21 × 10 × 6.5 cm',
    application: 'Structural & non-structural',
    description: 'Standard full-size kiln-fired clay brick, the backbone of residential and commercial construction.',
  },
  PAVING_BLOCK: {
    code: 'PAVING_BLOCK',
    name: 'Paving Block',
    dimensions: '20 × 10 × 6 cm',
    application: 'External paving',
    description: 'Durable interlocking clay paving blocks built to withstand heavy traffic, harsh weather, and years of use.',
  },
  HALF_BRICK: {
    code: 'HALF_BRICK',
    name: 'Half Brick',
    dimensions: '21 × 5 × 6.5 cm',
    application: 'Finishing & detailing',
    description: 'Precision-cut half bricks that complement Brick 10 for clean corner finishes and intricate detailing.',
  },
  LOW_ROCK_BOND: {
    code: 'LOW_ROCK_BOND',
    name: 'Low Rock Bond',
    dimensions: '21 × 5.5 × 10 cm',
    application: 'Feature & landscape',
    description: 'Flat, wide-profile brick with superior bonding properties, ideal for feature walls and landscape masonry.',
  },
  CUSTOM: {
    code: 'CUSTOM',
    name: 'Custom',
    dimensions: 'As specified',
    application: 'Custom order',
    description: 'Custom specification brick as per client requirements.',
  },
};

export const BRICK_TYPES = Object.keys(PRODUCTS);

export function getBrickLabel(code: string, customName?: string | null): string {
  if (code === 'CUSTOM') return customName || 'Custom';
  return PRODUCTS[code]?.name ?? code.replace(/_/g, ' ');
}

export function getBrickDimensions(code: string): string {
  return PRODUCTS[code]?.dimensions ?? '';
}
