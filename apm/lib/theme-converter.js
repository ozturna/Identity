(function() {
  var TextMateTheme, ThemeConverter, fs, path, request, url;

  path = require('path');

  url = require('url');

  fs = require('./fs');

  request = require('./request');

  TextMateTheme = require('./text-mate-theme');

  // Convert a TextMate theme to an Atom theme
  module.exports = ThemeConverter = class ThemeConverter {
    constructor(sourcePath1, destinationPath) {
      this.sourcePath = sourcePath1;
      this.destinationPath = path.resolve(destinationPath);
    }

    readTheme(callback) {
      var protocol, requestOptions, sourcePath;
      ({protocol} = url.parse(this.sourcePath));
      if (protocol === 'http:' || protocol === 'https:') {
        requestOptions = {
          url: this.sourcePath
        };
        return request.get(requestOptions, (error, response, body) => {
          if (error != null) {
            if (error.code === 'ENOTFOUND') {
              error = `Could not resolve URL: ${this.sourcePath}`;
            }
            return callback(error);
          } else if (response.statusCode !== 200) {
            return callback(`Request to ${this.sourcePath} failed (${response.headers.status})`);
          } else {
            return callback(null, body);
          }
        });
      } else {
        sourcePath = path.resolve(this.sourcePath);
        if (fs.isFileSync(sourcePath)) {
          return callback(null, fs.readFileSync(sourcePath, 'utf8'));
        } else {
          return callback(`TextMate theme file not found: ${sourcePath}`);
        }
      }
    }

    convert(callback) {
      return this.readTheme((error, themeContents) => {
        var theme;
        if (error != null) {
          return callback(error);
        }
        try {
          theme = new TextMateTheme(themeContents);
        } catch (error1) {
          error = error1;
          return callback(error);
        }
        fs.writeFileSync(path.join(this.destinationPath, 'styles', 'base.less'), theme.getStylesheet());
        fs.writeFileSync(path.join(this.destinationPath, 'styles', 'syntax-variables.less'), theme.getSyntaxVariables());
        return callback();
      });
    }

  };

}).call(this);
