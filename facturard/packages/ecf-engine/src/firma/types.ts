export interface CertificateData {
  /** Clave privada RSA en formato PEM */
  privateKeyPem: string;
  /** Certificado X.509 público en formato PEM */
  certificatePem: string;
}

export interface SignatureLocation {
  /** XPath al elemento padre donde se insertará el nodo <Signature> */
  reference: string;
  action: 'append' | 'prepend' | 'before' | 'after';
}

export interface SignXmlOptions {
  /**
   * XPath del elemento raíz a firmar.
   * Default: "//*[local-name(.)='ECF']"  (raíz del e-CF de la DGII)
   */
  referenceXPath?: string;
  /** Dónde insertar el elemento <Signature> dentro del documento */
  location?: SignatureLocation;
}
