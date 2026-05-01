/**
 * Robust price parsing and conversion utility
 */
export const parseCost = (priceStr: string | undefined): number | undefined => {
  if (!priceStr) return undefined;
  
  // Try to find numbers
  const numericPart = priceStr.replace(/[^0-9.]/g, '');
  if (numericPart && !isNaN(parseFloat(numericPart))) {
    return parseFloat(numericPart);
  }
  
  // Fallback map for common currency symbols/ranges
  const symbols: Record<string, number> = {
    '$$$$': 150,
    '$$$': 70,
    '$$': 30,
    '$': 10
  };
  
  return symbols[priceStr] || undefined;
};

export const formatPrice = (
  cost: number | undefined, 
  priceInEuro: string | undefined,
  currency: string, 
  rates: Record<string, number>,
  lang: string
): string | undefined => {
  let amount = cost;
  
  if (amount === undefined && priceInEuro) {
    amount = parseCost(priceInEuro);
  }
  
  if (amount === undefined || isNaN(amount)) {
    return priceInEuro; // Fallback to original string if we can't parse it
  }
  
  const rate = rates[currency] || 1;
  const finalAmount = amount * rate;
  
  // Standard currency formatting
  try {
    return new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0
    }).format(finalAmount);
  } catch (e) {
    // If currency not supported, fallback to simple string
    return `${currency} ${Math.round(finalAmount)}`;
  }
};
