export function convertInchesToDecimal(rawValue) {
  const text = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue ?? '').trim();

  if (text === '') {
    return {
      valid: false,
      value: 0,
      message: 'Please enter a measurement.',
    };
  }

  if (!/^\d+(\.\d)?$/.test(text)) {
    return {
      valid: false,
      value: 0,
      message: 'Use whole numbers or a single octal fraction such as 39.2 or 91.4.',
    };
  }

  const [wholePartText, fractionalText = ''] = text.split('.');
  const wholePart = Number(wholePartText);

  if (fractionalText !== '') {
    const fractionalDigit = Number(fractionalText);

    if (!Number.isInteger(fractionalDigit) || fractionalDigit < 0 || fractionalDigit > 7) {
      return {
        valid: false,
        value: 0,
        message: 'Fractional readings must use a single octal digit from 0 to 7.',
      };
    }

    return {
      valid: true,
      value: wholePart + fractionalDigit / 8,
      message: '',
    };
  }

  return {
    valid: true,
    value: wholePart,
    message: '',
  };
}
