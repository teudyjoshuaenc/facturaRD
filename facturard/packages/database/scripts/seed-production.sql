-- Seed tenant DMAIA SRL en producción
-- Idempotente: ON CONFLICT (rnc) DO NOTHING
INSERT INTO tenants (
  id,
  rnc,
  "razonSocial",
  "nombreComercial",
  plan,
  estado,
  direccion,
  "planActivo",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  '132883225',
  'DMAIA SRL',
  'DMAIA',
  'PRO',
  'ACTIVO',
  'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
  true,
  NOW(),
  NOW()
) ON CONFLICT (rnc) DO NOTHING;
