import { resolveDgiiEnv, resolveEndpoints } from '../src/dgii';

describe('DGII_ENV → ambiente', () => {
  const original = process.env['DGII_ENV'];
  afterEach(() => {
    if (original === undefined) delete process.env['DGII_ENV'];
    else process.env['DGII_ENV'] = original;
  });

  it.each([
    ['production', 'ecf'],
    ['test', 'testecf'],
    ['certification', 'certecf'],
    ['', 'certecf'],
  ])('DGII_ENV=%s → %s', (valor, esperado) => {
    process.env['DGII_ENV'] = valor;
    expect(resolveDgiiEnv()).toBe(esperado);
  });

  it('sin DGII_ENV → certecf (default seguro)', () => {
    delete process.env['DGII_ENV'];
    expect(resolveDgiiEnv()).toBe('certecf');
  });

  it('testecf usa las rutas /TesteCF/', () => {
    const e = resolveEndpoints('testecf');
    for (const url of Object.values(e)) expect(url).toContain('/TesteCF/');
  });
});
