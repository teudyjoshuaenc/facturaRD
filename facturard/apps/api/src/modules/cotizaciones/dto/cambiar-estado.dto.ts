import { IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CambiarEstadoDto {
  @ApiProperty({ enum: ['ENVIADA', 'APROBADA', 'RECHAZADA'] })
  @IsIn(['ENVIADA', 'APROBADA', 'RECHAZADA'])
  estado!: string
}
