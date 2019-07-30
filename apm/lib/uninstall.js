(function() {
  var CSON, Command, Uninstall, async, auth, config, fs, path, request, yargs;

  path = require('path');

  async = require('async');

  CSON = require('season');

  yargs = require('yargs');

  auth = require('./auth');

  Command = require('./command');

  config = require('./apm');

  fs = require('./fs');

  request = require('./request');

  module.exports = Uninstall = (function() {
    class Uninstall extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm uninstall <package_name>...\n\nDelete the installed package(s) from the ~/.atom/packages directory.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.alias('d', 'dev').boolean('dev').describe('dev', 'Uninstall from ~/.atom/dev/packages');
        return options.boolean('hard').describe('hard', 'Uninstall from ~/.atom/packages and ~/.atom/dev/packages');
      }

      getPackageVersion(packageDirectory) {
        var error, ref;
        try {
          return (ref = CSON.readFileSync(path.join(packageDirectory, 'package.json'))) != null ? ref.version : void 0;
        } catch (error1) {
          error = error1;
          return null;
        }
      }

      registerUninstall({packageName, packageVersion}, callback) {
        if (!packageVersion) {
          return callback();
        }
        return auth.getToken(function(error, token) {
          var requestOptions;
          if (!token) {
            return callback();
          }
          requestOptions = {
            url: `${config.getAtomPackagesUrl()}/${packageName}/versions/${packageVersion}/events/uninstall`,
            json: true,
            headers: {
              authorization: token
            }
          };
          return request.post(requestOptions, function(error, response, body) {
            return callback();
          });
        });
      }

      run(options) {
        var callback, devPackagesDirectory, error, i, len, packageDirectory, packageName, packageNames, packageVersion, packagesDirectory, uninstallError, uninstallsToRegister;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        packageNames = this.packageNamesFromArgv(options.argv);
        if (packageNames.length === 0) {
          callback("Please specify a package name to uninstall");
          return;
        }
        packagesDirectory = path.join(config.getAtomDirectory(), 'packages');
        devPackagesDirectory = path.join(config.getAtomDirectory(), 'dev', 'packages');
        uninstallsToRegister = [];
        uninstallError = null;
        for (i = 0, len = packageNames.length; i < len; i++) {
          packageName = packageNames[i];
          process.stdout.write(`Uninstalling ${packageName} `);
          try {
            if (!options.argv.dev) {
              packageDirectory = path.join(packagesDirectory, packageName);
              if (fs.existsSync(packageDirectory)) {
                packageVersion = this.getPackageVersion(packageDirectory);
                fs.removeSync(packageDirectory);
                if (packageVersion) {
                  uninstallsToRegister.push({packageName, packageVersion});
                }
              } else if (!options.argv.hard) {
                throw new Error("Does not exist");
              }
            }
            if (options.argv.hard || options.argv.dev) {
              packageDirectory = path.join(devPackagesDirectory, packageName);
              if (fs.existsSync(packageDirectory)) {
                fs.removeSync(packageDirectory);
              } else if (!options.argv.hard) {
                throw new Error("Does not exist");
              }
            }
            this.logSuccess();
          } catch (error1) {
            error = error1;
            this.logFailure();
            uninstallError = new Error(`Failed to delete ${packageName}: ${error.message}`);
            break;
          }
        }
        return async.eachSeries(uninstallsToRegister, this.registerUninstall.bind(this), function() {
          return callback(uninstallError);
        });
      }

    };

    Uninstall.commandNames = ['deinstall', 'delete', 'erase', 'remove', 'rm', 'uninstall'];

    return Uninstall;

  }).call(this);

}).call(this);
