import { extractedName } from './renderExtracted';

describe('extractedName', () => {
  it('nombra las imágenes como PDFCartas y añade « xN» si se repiten', () => {
    expect(extractedName('juego', 0, 1, 'jpg')).toBe('juego_img_1.jpg');
    expect(extractedName('juego', 2, 9, 'png')).toBe('juego_img_3 x9.png');
  });
});
