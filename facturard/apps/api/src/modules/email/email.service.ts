import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as sgMail from '@sendgrid/mail'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly from: string
  private readonly enabled: boolean

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY', '')
    this.from = this.config.get<string>('SENDGRID_FROM', 'noreply@facturard.do')
    // Solo activa SendGrid si la clave no es el placeholder
    this.enabled = apiKey.length > 10 && apiKey !== 'SG.xxx'
    if (this.enabled) {
      sgMail.setApiKey(apiKey)
    }
  }

  async sendResetPassword(email: string, nombre: string, resetLink: string): Promise<void> {
    const subject = 'Restablecer contraseña — FacturaRD'
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Hola, ${nombre}</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>FacturaRD</strong>.</p>
        <p>Haz clic en el botón para continuar (válido por <strong>1 hora</strong>):</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${resetLink}"
             style="background:#4F46E5;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
            Restablecer contraseña
          </a>
        </p>
        <p style="color:#6B7280;font-size:13px">
          Si no solicitaste esto, puedes ignorar este correo.
          El enlace expira en 1 hora.<br><br>
          <code style="word-break:break-all">${resetLink}</code>
        </p>
      </div>
    `

    if (!this.enabled) {
      // En desarrollo: loguear el enlace en lugar de enviar
      this.logger.warn(
        `[DEV] SendGrid desactivado — reset link para ${email}:\n${resetLink}`,
      )
      return
    }

    try {
      await sgMail.send({ to: email, from: this.from, subject, html })
      this.logger.log(`Email de reset enviado a ${email}`)
    } catch (err) {
      this.logger.error(`Error enviando email a ${email}: ${String(err)}`)
      throw err
    }
  }
}
