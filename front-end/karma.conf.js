// Les tests de l'interface tournent dans un Chrome sans fenêtre.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    customLaunchers: {
      ChromeSansFenetre: { base: 'ChromeHeadless', flags: ['--no-sandbox', '--disable-gpu'] },
    },
    browsers: ['ChromeSansFenetre'],
    reporters: ['progress'],
    restartOnFileChange: true,
  });
};
