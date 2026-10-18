import { parseCopies } from './filename';

describe('parseCopies', () => {
  it('lee el número de copias del sufijo " xN" antes de la extensión', () => {
    expect(parseCopies('Héroe x3.png')).toBe(3);
    expect(parseCopies('carta 01 x12.jpg')).toBe(12);
  });

  it('devuelve null si no hay sufijo o no es un número', () => {
    expect(parseCopies('carta.png')).toBeNull();
    expect(parseCopies('carta xa.png')).toBeNull();
    expect(parseCopies('box x2 back.png')).toBeNull();
  });

  it('ignora el sufijo si no hay extensión o si es cero', () => {
    expect(parseCopies('carta x3')).toBeNull();
    expect(parseCopies('carta x0.png')).toBeNull();
  });
});
