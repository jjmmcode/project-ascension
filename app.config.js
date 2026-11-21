// Extiende app.json. En GitHub Actions, cada compilación recibe un versionCode mayor
// para que Android la instale como actualización de la anterior.
// +100: el repositorio público empezó de cero su numeración de builds (el privado llegó a la 19);
// sin el desfase, Android rechazaría la instalación por ser un versionCode menor.
const BUILD_OFFSET = 100;

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: process.env.GITHUB_RUN_NUMBER
      ? BUILD_OFFSET + Number(process.env.GITHUB_RUN_NUMBER)
      : (config.android?.versionCode ?? 1),
  },
});
