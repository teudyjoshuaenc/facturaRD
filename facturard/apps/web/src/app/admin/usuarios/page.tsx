'use client'

import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { adminApi, fechaHora, mensajeError, sesionAdmin } from '@/lib/admin'

interface UsuarioPanel {
  id: string
  email: string
  nombre: string
  rol: 'ADMIN' | 'SOPORTE'
  activo: boolean
  totpActivo: boolean
  ultimoAcceso: string | null
}

const ROLES = [
  { value: 'SOPORTE', label: 'Soporte' },
  { value: 'ADMIN', label: 'Administrador' },
]

export default function AdminUsuariosPage(): JSX.Element {
  const qc = useQueryClient()
  const yo = sesionAdmin()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'usuarios'],
    queryFn: async () => (await adminApi.get<UsuarioPanel[]>('/usuarios')).data,
  })
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', rol: 'SOPORTE', password: '' })
  const [creando, setCreando] = useState(false)

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setCreando(true)
    try {
      await adminApi.post('/usuarios', nuevo)
      toast.success(`${nuevo.email} creado. Configura su 2FA al entrar por primera vez.`)
      setNuevo({ nombre: '', email: '', rol: 'SOPORTE', password: '' })
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setCreando(false)
    }
  }

  async function actualizar(id: string, cambios: Partial<Pick<UsuarioPanel, 'activo' | 'rol'>>): Promise<void> {
    try {
      await adminApi.patch(`/usuarios/${id}`, cambios)
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 font-bold text-text-primary">Usuarios del panel</h1>
        <p className="text-body-sm text-text-secondary">El equipo de DMAIA. No son usuarios de los clientes: tienen su propio acceso con 2FA obligatorio.</p>
      </div>

      <form onSubmit={crear} className="grid grid-cols-1 gap-4 rounded-2xl border border-neutral-200 bg-white p-5 md:grid-cols-5 md:items-end">
        <Input id="u-nombre" label="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Input id="u-email" label="Correo" type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-semibold text-text-secondary">Rol</span>
          <Select value={nuevo.rol} options={ROLES} onChange={(v) => setNuevo({ ...nuevo, rol: v })} />
        </div>
        <Input
          id="u-password"
          label="Contraseña inicial"
          type="password"
          autoComplete="new-password"
          value={nuevo.password}
          onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
          helperText="12+ con mayúscula, número y símbolo"
        />
        <Button type="submit" disabled={creando || !nuevo.nombre || !nuevo.email || nuevo.password.length < 12}>
          {creando ? 'Creando…' : 'Crear usuario'}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-ui-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-ui-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-3 py-3">Rol</th>
              <th className="px-3 py-3">2FA</th>
              <th className="px-3 py-3">Último acceso</th>
              <th className="px-3 py-3">Acceso</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="py-10 text-center"><Spinner size={22} /></td></tr>}
            {error && <tr><td colSpan={5} className="py-8 text-center text-danger-700">{mensajeError(error)}</td></tr>}
            {data?.map((u) => {
              const soyYo = u.id === yo?.id
              return (
                <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text-primary">{u.nombre}{soyYo && <span className="ml-1.5 text-ui-xs text-text-secondary">(tú)</span>}</div>
                    <div className="text-ui-xs text-text-secondary">{u.email}</div>
                  </td>
                  <td className="w-44 px-3 py-3">
                    {soyYo ? (
                      <Badge variant="info">{u.rol === 'ADMIN' ? 'Administrador' : 'Soporte'}</Badge>
                    ) : (
                      <Select value={u.rol} options={ROLES} onChange={(v) => void actualizar(u.id, { rol: v as UsuarioPanel['rol'] })} />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={u.totpActivo ? 'success' : 'warning'}>{u.totpActivo ? 'Activa' : 'Pendiente'}</Badge>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{fechaHora(u.ultimoAcceso)}</td>
                  <td className="px-3 py-3">
                    {soyYo ? (
                      <span className="text-text-disabled">—</span>
                    ) : (
                      <Button size="sm" variant={u.activo ? 'secondary' : 'primary'} onClick={() => void actualizar(u.id, { activo: !u.activo })}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
