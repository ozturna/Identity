(function() {
  var Command, Login, Unstar, async, config, request, yargs;

  async = require('async');

  yargs = require('yargs');

  config = require('./apm');

  Command = require('./command');

  Login = require('./login');

  request = require('./request');

  module.exports = Unstar = (function() {
    class Unstar extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm unstar <package_name>...\n\nUnstar the given packages on https://atom.io\n\nRun `apm stars` to see all your starred packages.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      starPackage(packageName, token, callback) {
        var requestSettings;
        if (process.platform === 'darwin') {
          process.stdout.write('\uD83D\uDC5F \u2B50  ');
        }
        process.stdout.write(`Unstarring ${packageName} `);
        requestSettings = {
          json: true,
          url: `${config.getAtomPackagesUrl()}/${packageName}/star`,
          headers: {
            authorization: token
          }
        };
        return request.del(requestSettings, (error, response, body = {}) => {
          var message, ref, ref1;
          if (error != null) {
            this.logFailure();
            return callback(error);
          } else if (response.statusCode !== 204) {
            this.logFailure();
            message = (ref = (ref1 = body.message) != null ? ref1 : body.error) != null ? ref : body;
            return callback(`Unstarring package failed: ${message}`);
          } else {
            this.logSuccess();
            return callback();
          }
        });
      }

      run(options) {
        var callback, packageNames;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        packageNames = this.packageNamesFromArgv(options.argv);
        if (packageNames.length === 0) {
          callback("Please specify a package name to unstar");
          return;
        }
        return Login.getTokenOrLogin((error, token) => {
          var commands;
          if (error != null) {
            return callback(error);
          }
          commands = packageNames.map((packageName) => {
            return (callback) => {
              return this.starPackage(packageName, token, callback);
            };
          });
          return async.waterfall(commands, callback);
        });
      }

    };

    Unstar.commandNames = ['unstar'];

    return Unstar;

  }).call(this);

}).call(this);
