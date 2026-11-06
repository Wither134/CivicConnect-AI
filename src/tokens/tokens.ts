export const TOKENS = {
  brand: {
    name: 'CommunityConnect',
    tagline: 'Report it. Track it. See it fixed.',
    supporting: 'Streetlights, roads and waste, reported in minutes and followed to a recorded resolution.'
  },
  colors: {
    primaryOrange: '#FF873E',
    deepOrange: '#E65D25',
    burntOrange: '#B93E16',
    forestGreen: '#174B38',
    emerald: '#287A58',
    sage: '#91B69C',
    warmIvory: '#F7F7F1',
    white: '#FFFFFF',
    charcoal: '#25312B',
    mutedGrey: '#7D8981',
    gradients: {
      hero: 'linear-gradient(115deg, #FF945E 0%, #E65D25 55%, #B93E16 100%)',
      green: 'linear-gradient(135deg, #174B38 0%, #287A58 55%, #75A98B 100%)',
      soft: 'linear-gradient(135deg, #F5F7F1 0%, #EAF2EB 50%, #F8F3EA 100%)',
      orangeAccent: 'linear-gradient(135deg, #D48A68 0%, #E8B28A 100%)'
    }
  },
  typography: {
    hero: "'DM Serif Display', 'Playfair Display', Georgia, serif",
    headings: "'Manrope', -apple-system, sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  }
} as const;
