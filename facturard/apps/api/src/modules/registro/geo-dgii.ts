// Tabla III de la DGII — Codificación Provincias y Municipios (Formato e-CF v1.0).
// Sólo provincias (XX0000) y municipios (XXYY00); los distritos municipales no se piden.
// Generado desde el documento oficial; no editar a mano.

export interface MunicipioDgii { codigo: string; nombre: string }
export interface ProvinciaDgii { codigo: string; nombre: string; municipios: MunicipioDgii[] }

export const PROVINCIAS_DGII: ProvinciaDgii[] = [
  {
    codigo: "020000",
    nombre: "Azua",
    municipios: [
      {
        codigo: "020100",
        nombre: "Azua"
      },
      {
        codigo: "020200",
        nombre: "Las Charcas"
      },
      {
        codigo: "020300",
        nombre: "Las Yayas de Viajama"
      },
      {
        codigo: "020400",
        nombre: "Padre Las Casas"
      },
      {
        codigo: "020500",
        nombre: "Peralta"
      },
      {
        codigo: "020600",
        nombre: "Sabana Yegua"
      },
      {
        codigo: "020700",
        nombre: "Pueblo Viejo"
      },
      {
        codigo: "020800",
        nombre: "Tábara Arriba"
      },
      {
        codigo: "020900",
        nombre: "Guayabal"
      },
      {
        codigo: "021000",
        nombre: "Estebanía"
      }
    ]
  },
  {
    codigo: "030000",
    nombre: "Bahoruco",
    municipios: [
      {
        codigo: "030200",
        nombre: "Galván"
      },
      {
        codigo: "030300",
        nombre: "Tamayo"
      },
      {
        codigo: "030400",
        nombre: "Villa Jaragua"
      },
      {
        codigo: "030500",
        nombre: "Los Ríos"
      }
    ]
  },
  {
    codigo: "040000",
    nombre: "Barahona",
    municipios: [
      {
        codigo: "040100",
        nombre: "Barahona"
      },
      {
        codigo: "040200",
        nombre: "Cabral"
      },
      {
        codigo: "040300",
        nombre: "Enriquillo"
      },
      {
        codigo: "040400",
        nombre: "Paraíso"
      },
      {
        codigo: "040500",
        nombre: "Vicente Noble"
      },
      {
        codigo: "040600",
        nombre: "El Peñón"
      },
      {
        codigo: "040700",
        nombre: "La Ciénaga"
      },
      {
        codigo: "040800",
        nombre: "Fundación"
      },
      {
        codigo: "040900",
        nombre: "Las Salinas"
      },
      {
        codigo: "041000",
        nombre: "Polo"
      },
      {
        codigo: "041100",
        nombre: "Jaquimeyes"
      }
    ]
  },
  {
    codigo: "050000",
    nombre: "Dajabón",
    municipios: [
      {
        codigo: "050100",
        nombre: "Dajabón"
      },
      {
        codigo: "050200",
        nombre: "Loma de Cabrera"
      },
      {
        codigo: "050300",
        nombre: "Partido"
      },
      {
        codigo: "050400",
        nombre: "Restauración"
      },
      {
        codigo: "050500",
        nombre: "El Pino"
      }
    ]
  },
  {
    codigo: "010000",
    nombre: "Distrito Nacional",
    municipios: [
      {
        codigo: "010100",
        nombre: "Santo Domingo de Guzmán"
      }
    ]
  },
  {
    codigo: "060000",
    nombre: "Duarte",
    municipios: [
      {
        codigo: "060100",
        nombre: "San Francisco de Macorís"
      },
      {
        codigo: "060200",
        nombre: "Arenoso"
      },
      {
        codigo: "060300",
        nombre: "Castillo"
      },
      {
        codigo: "060400",
        nombre: "Pimentel"
      },
      {
        codigo: "060500",
        nombre: "Villa Riva"
      },
      {
        codigo: "060600",
        nombre: "Las Guáranas"
      },
      {
        codigo: "060700",
        nombre: "Eugenio María de Hostos"
      }
    ]
  },
  {
    codigo: "080000",
    nombre: "El Seibo",
    municipios: [
      {
        codigo: "080100",
        nombre: "El Seibo"
      },
      {
        codigo: "080200",
        nombre: "Miches"
      }
    ]
  },
  {
    codigo: "070000",
    nombre: "Elías Piña",
    municipios: [
      {
        codigo: "070100",
        nombre: "Comendador"
      },
      {
        codigo: "070200",
        nombre: "Bánica"
      },
      {
        codigo: "070300",
        nombre: "El Llano"
      },
      {
        codigo: "070400",
        nombre: "Hondo Valle"
      },
      {
        codigo: "070500",
        nombre: "Pedro Santana"
      },
      {
        codigo: "070600",
        nombre: "Juan Santiago"
      }
    ]
  },
  {
    codigo: "090000",
    nombre: "Espaillat",
    municipios: [
      {
        codigo: "090100",
        nombre: "Moca"
      },
      {
        codigo: "090200",
        nombre: "Cayetano Germosén"
      },
      {
        codigo: "090300",
        nombre: "Gaspar Hernández"
      },
      {
        codigo: "090400",
        nombre: "Jamao Al Norte"
      }
    ]
  },
  {
    codigo: "300000",
    nombre: "Hato Mayor",
    municipios: [
      {
        codigo: "300100",
        nombre: "Hato Mayor"
      },
      {
        codigo: "300200",
        nombre: "Sabana de la Mar"
      },
      {
        codigo: "300300",
        nombre: "El Valle"
      }
    ]
  },
  {
    codigo: "190000",
    nombre: "Hermanas Mirabal",
    municipios: [
      {
        codigo: "190100",
        nombre: "Salcedo"
      },
      {
        codigo: "190200",
        nombre: "Tenares"
      },
      {
        codigo: "190300",
        nombre: "Villa Tapia"
      }
    ]
  },
  {
    codigo: "100000",
    nombre: "Independencia",
    municipios: [
      {
        codigo: "100100",
        nombre: "Jimaní"
      },
      {
        codigo: "100200",
        nombre: "Duvergé"
      },
      {
        codigo: "100300",
        nombre: "La Descubierta"
      },
      {
        codigo: "100400",
        nombre: "Postrer Río"
      },
      {
        codigo: "100500",
        nombre: "Cristóbal"
      },
      {
        codigo: "100600",
        nombre: "Mella"
      }
    ]
  },
  {
    codigo: "110000",
    nombre: "La Altagracia",
    municipios: [
      {
        codigo: "110100",
        nombre: "Higüey"
      },
      {
        codigo: "110200",
        nombre: "San Rafael del Yuma"
      }
    ]
  },
  {
    codigo: "120000",
    nombre: "La Romana",
    municipios: [
      {
        codigo: "120100",
        nombre: "La Romana"
      },
      {
        codigo: "120200",
        nombre: "Guaymate"
      },
      {
        codigo: "120300",
        nombre: "Villa Hermosa"
      }
    ]
  },
  {
    codigo: "130000",
    nombre: "La Vega",
    municipios: [
      {
        codigo: "130100",
        nombre: "La Vega"
      },
      {
        codigo: "130200",
        nombre: "Constanza"
      },
      {
        codigo: "130300",
        nombre: "Jarabacoa"
      },
      {
        codigo: "130400",
        nombre: "Jima Abajo"
      }
    ]
  },
  {
    codigo: "140000",
    nombre: "María Trinidad Sánchez",
    municipios: [
      {
        codigo: "140100",
        nombre: "Nagua"
      },
      {
        codigo: "140200",
        nombre: "Cabrera"
      },
      {
        codigo: "140300",
        nombre: "El Factor"
      },
      {
        codigo: "140400",
        nombre: "Río San Juan"
      }
    ]
  },
  {
    codigo: "280000",
    nombre: "Monseñor Nouel",
    municipios: [
      {
        codigo: "280100",
        nombre: "Bonao"
      },
      {
        codigo: "280200",
        nombre: "Maimón"
      },
      {
        codigo: "280300",
        nombre: "Piedra Blanca"
      }
    ]
  },
  {
    codigo: "150000",
    nombre: "Monte Cristi",
    municipios: [
      {
        codigo: "150100",
        nombre: "Monte Cristi"
      },
      {
        codigo: "150200",
        nombre: "Castañuelas"
      },
      {
        codigo: "150300",
        nombre: "Guayubín"
      },
      {
        codigo: "150400",
        nombre: "Las Matas de Santa Cruz"
      },
      {
        codigo: "150500",
        nombre: "Pepillo Salcedo"
      },
      {
        codigo: "150600",
        nombre: "Villa Vásquez"
      }
    ]
  },
  {
    codigo: "290000",
    nombre: "Monte Plata",
    municipios: [
      {
        codigo: "290100",
        nombre: "Monte Plata"
      },
      {
        codigo: "290200",
        nombre: "Bayaguana"
      },
      {
        codigo: "290300",
        nombre: "Sabana Grande de Boyá"
      },
      {
        codigo: "290400",
        nombre: "Yamasá"
      },
      {
        codigo: "290500",
        nombre: "Peralvillo"
      }
    ]
  },
  {
    codigo: "160000",
    nombre: "Pedernales",
    municipios: [
      {
        codigo: "160100",
        nombre: "Pedernales"
      },
      {
        codigo: "160200",
        nombre: "Oviedo"
      }
    ]
  },
  {
    codigo: "170000",
    nombre: "Peravia",
    municipios: [
      {
        codigo: "170100",
        nombre: "Baní"
      },
      {
        codigo: "170200",
        nombre: "Nizao"
      },
      {
        codigo: "170300",
        nombre: "Matanzas"
      }
    ]
  },
  {
    codigo: "180000",
    nombre: "Puerto Plata",
    municipios: [
      {
        codigo: "180100",
        nombre: "Puerto Plata"
      },
      {
        codigo: "180200",
        nombre: "Altamira"
      },
      {
        codigo: "180300",
        nombre: "Guananico"
      },
      {
        codigo: "180400",
        nombre: "Imbert"
      },
      {
        codigo: "180500",
        nombre: "Los Hidalgos"
      },
      {
        codigo: "180600",
        nombre: "Luperón"
      },
      {
        codigo: "180700",
        nombre: "Sosúa"
      },
      {
        codigo: "180800",
        nombre: "Villa Isabela"
      },
      {
        codigo: "180900",
        nombre: "Villa Montellano"
      }
    ]
  },
  {
    codigo: "200000",
    nombre: "Samaná",
    municipios: [
      {
        codigo: "200100",
        nombre: "Samaná"
      },
      {
        codigo: "200200",
        nombre: "Sánchez"
      },
      {
        codigo: "200300",
        nombre: "Las Terrenas"
      }
    ]
  },
  {
    codigo: "210000",
    nombre: "San Cristóbal",
    municipios: [
      {
        codigo: "210100",
        nombre: "San Cristóbal"
      },
      {
        codigo: "210200",
        nombre: "Sabana Grande de Palenque"
      },
      {
        codigo: "210300",
        nombre: "Bajos de Haina"
      },
      {
        codigo: "210400",
        nombre: "Cambita Garabitos"
      },
      {
        codigo: "210500",
        nombre: "Villa Altagracia"
      },
      {
        codigo: "210600",
        nombre: "Yaguate"
      },
      {
        codigo: "210700",
        nombre: "San Gregorio de Nigua"
      },
      {
        codigo: "210800",
        nombre: "Los Cacaos"
      }
    ]
  },
  {
    codigo: "310000",
    nombre: "San José de Ocoa",
    municipios: [
      {
        codigo: "310100",
        nombre: "San José de Ocoa"
      },
      {
        codigo: "310200",
        nombre: "Sabana Larga"
      },
      {
        codigo: "310300",
        nombre: "Rancho Arriba"
      }
    ]
  },
  {
    codigo: "220000",
    nombre: "San Juan",
    municipios: [
      {
        codigo: "220100",
        nombre: "San Juan"
      },
      {
        codigo: "220200",
        nombre: "Bohechío"
      },
      {
        codigo: "220300",
        nombre: "El Cercado"
      },
      {
        codigo: "220400",
        nombre: "Juan de Herrera"
      },
      {
        codigo: "220500",
        nombre: "Las Matas de Farfán"
      },
      {
        codigo: "220600",
        nombre: "Vallejuelo"
      }
    ]
  },
  {
    codigo: "230000",
    nombre: "San Pedro de Macorís",
    municipios: [
      {
        codigo: "230100",
        nombre: "San Pedro de Macorís"
      },
      {
        codigo: "230200",
        nombre: "Los Llanos"
      },
      {
        codigo: "230300",
        nombre: "Ramón Santana"
      },
      {
        codigo: "230400",
        nombre: "Consuelo"
      },
      {
        codigo: "230500",
        nombre: "Quisqueya"
      },
      {
        codigo: "230600",
        nombre: "Guayacanes"
      }
    ]
  },
  {
    codigo: "250000",
    nombre: "Santiago",
    municipios: [
      {
        codigo: "250100",
        nombre: "Santiago"
      },
      {
        codigo: "250200",
        nombre: "Bisonó"
      },
      {
        codigo: "250300",
        nombre: "Jánico"
      },
      {
        codigo: "250400",
        nombre: "Licey Al Medio"
      },
      {
        codigo: "250500",
        nombre: "San José de Las Matas"
      },
      {
        codigo: "250600",
        nombre: "Tamboril"
      },
      {
        codigo: "250700",
        nombre: "Villa González"
      },
      {
        codigo: "250800",
        nombre: "Puñal"
      },
      {
        codigo: "250900",
        nombre: "Sabana Iglesia"
      },
      {
        codigo: "251000",
        nombre: "Baitoa"
      }
    ]
  },
  {
    codigo: "260000",
    nombre: "Santiago Rodríguez",
    municipios: [
      {
        codigo: "260100",
        nombre: "San Ignacio de Sabaneta"
      },
      {
        codigo: "260200",
        nombre: "Villa Los Almácigos"
      },
      {
        codigo: "260300",
        nombre: "Monción"
      }
    ]
  },
  {
    codigo: "320000",
    nombre: "Santo Domingo",
    municipios: [
      {
        codigo: "320100",
        nombre: "Santo Domingo Este"
      },
      {
        codigo: "320200",
        nombre: "Santo Domingo Oeste"
      },
      {
        codigo: "320300",
        nombre: "Santo Domingo Norte"
      },
      {
        codigo: "320400",
        nombre: "Boca Chica"
      },
      {
        codigo: "320500",
        nombre: "San Antonio de Guerra"
      },
      {
        codigo: "320600",
        nombre: "Los Alcarrizos"
      },
      {
        codigo: "320700",
        nombre: "Pedro Brand"
      }
    ]
  },
  {
    codigo: "240000",
    nombre: "Sánchez Ramírez",
    municipios: [
      {
        codigo: "240100",
        nombre: "Cotuí"
      },
      {
        codigo: "240200",
        nombre: "Cevicos"
      },
      {
        codigo: "240300",
        nombre: "Fantino"
      },
      {
        codigo: "240400",
        nombre: "La Mata"
      }
    ]
  },
  {
    codigo: "270000",
    nombre: "Valverde",
    municipios: [
      {
        codigo: "270100",
        nombre: "Mao"
      },
      {
        codigo: "270200",
        nombre: "Esperanza"
      },
      {
        codigo: "270300",
        nombre: "Laguna Salada"
      }
    ]
  }
]

/** true si el municipio pertenece a la provincia (ambos códigos de la Tabla III). */
export function municipioValido(provincia: string, municipio: string): boolean {
  const p = PROVINCIAS_DGII.find((x) => x.codigo === provincia)
  return Boolean(p && p.municipios.some((m) => m.codigo === municipio))
}
