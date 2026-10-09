import { convertInchesToDecimal } from './conversion.js';

export function calculateSquareFeet(heightValue, widthValue) {
  const heightResult = convertInchesToDecimal(heightValue);
  const widthResult = convertInchesToDecimal(widthValue);

  if (!heightResult.valid || !widthResult.valid) {
    return {
      valid: false,
      area: 0,
      errors: {
        height: heightResult.valid ? '' : heightResult.message,
        width: widthResult.valid ? '' : widthResult.message,
      },
    };
  }

  const area = (heightResult.value * widthResult.value) / 144;

  return {
    valid: true,
    area,
    errors: {
      height: '',
      width: '',
    },
  };
}

export function formatSquareFeet(value, precision = 4) {
  return Number(value).toFixed(Number.isInteger(precision) ? precision : 4);
}

export function getWardrobeTotals(rowElements) {
  let all = 0;
  let included = 0;
  let excluded = 0;

  rowElements.forEach((row) => {
    const heightInput = row.querySelector('[data-role="height"]');
    const widthInput = row.querySelector('[data-role="width"]');
    const includeCheckbox = row.querySelector('input[type="checkbox"]');

    if (!heightInput || !widthInput || !includeCheckbox) {
      return;
    }

    const heightText = heightInput.value.trim();
    const widthText = widthInput.value.trim();

    if (heightText === '' || widthText === '') {
      return;
    }

    const calculation = calculateSquareFeet(heightText, widthText);

    if (!calculation.valid) {
      return;
    }

    all += calculation.area;

    if (includeCheckbox.checked) {
      included += calculation.area;
    } else {
      excluded += calculation.area;
    }
  });

  return {
    all,
    included,
    excluded,
  };
}
