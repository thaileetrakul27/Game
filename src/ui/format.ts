// Display formatting only. No game rules belong here.

const wholeNumber = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export function money(value: number): string {
  return wholeNumber.format(value)
}

export function percent(value: number): string {
  return `${Number(value.toFixed(2))}%`
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}
