module.exports = (options) => ({
  ...options,
  externals: [
    ...(Array.isArray(options.externals) ? options.externals : []),
    '@sendgrid/mail',
  ],
})
