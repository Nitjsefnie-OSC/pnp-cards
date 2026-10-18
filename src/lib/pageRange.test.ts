import { pagePixels, parsePageRange } from './pageRange';

describe('parsePageRange', () => {
  it('vacío significa todas las páginas', () => {
    expect(parsePageRange('', 4)).toEqual([1, 2, 3, 4]);
    expect(parsePageRange('   ', 2)).toEqual([1, 2]);
  });

  it('acepta páginas sueltas y rangos separados por comas', () => {
    expect(parsePageRange('1-3, 5', 10)).toEqual([1, 2, 3, 5]);
  });

  it('un rango abierto llega hasta el final o empieza en la primera', () => {
    expect(parsePageRange('8-', 10)).toEqual([8, 9, 10]);
    expect(parsePageRange('-2', 10)).toEqual([1, 2]);
  });

  it('ordena y quita repetidas', () => {
    expect(parsePageRange('5, 1-2, 2', 10)).toEqual([1, 2, 5]);
  });

  it('acepta punto y coma y espacios de sobra', () => {
    expect(parsePageRange(' 1 ; 3 - 4 ', 10)).toEqual([1, 3, 4]);
  });

  it('devuelve null si hay páginas fuera del documento o texto no válido', () => {
    expect(parsePageRange('0', 10)).toBeNull();
    expect(parsePageRange('11', 10)).toBeNull();
    expect(parsePageRange('3-1', 10)).toBeNull();
    expect(parsePageRange('uno', 10)).toBeNull();
  });
});

describe('pagePixels', () => {
  it('convierte el tamaño de la página en puntos a píxeles a los ppp elegidos', () => {
    // A4 = 595 × 842 pt; a 300 ppp, 2479 × 3508 px (como Acrobat: redondeando).
    expect(pagePixels({ width: 595, height: 842 }, 300)).toEqual({ width: 2479, height: 3508 });
    expect(pagePixels({ width: 72, height: 144 }, 150)).toEqual({ width: 150, height: 300 });
  });
});
