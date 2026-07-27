const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function convert(num: number): string {
  if (num === 0) return ''
  if (num < 20) return ONES[num] + ' '
  if (num < 100) return TENS[Math.floor(num / 10)] + (num % 10 ? ' ' + ONES[num % 10] : '') + ' '
  if (num < 1_000) return ONES[Math.floor(num / 100)] + ' hundred ' + convert(num % 100)
  if (num < 1_000_000) return convert(Math.floor(num / 1_000)) + 'thousand ' + convert(num % 1_000)
  if (num < 1_000_000_000) return convert(Math.floor(num / 1_000_000)) + 'million ' + convert(num % 1_000_000)
  return convert(Math.floor(num / 1_000_000_000)) + 'billion ' + convert(num % 1_000_000_000)
}

export function numberToWords(n: number): string {
  const raw = convert(Math.round(n)).trim().replace(/\s+/g, ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
