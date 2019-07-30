(function() {
  var CSON, Command, Login, Packages, Star, _, async, config, fs, path, request, yargs;

  path = require('path');

  _ = require('underscore-plus');

  async = require('async');

  CSON = require('season');

  yargs = require('yargs');

  config = require('./apm');

  Command = require('./command');

  fs = require('./fs');

  Login = require('./login');

  Packages = require('./packages');

  request = require('./request');

  module.exports = Star = (function() {
    class Star extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm star <package_name>...\n\nStar the given packages on https://atom.io\n\nRun `apm stars` to see all your starred packages.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        return options.boolean('installed').describe('installed', 'Star all packages in ~/.atom/packages');
      }

      starPackage(packageName, {ignoreUnpublishedPackages, token} = {}, callback) {
        var requestSettings;
        if (process.platform === 'darwin') {
          process.stdout.write('\u2B50  ');
        }
        process.stdout.write(`Starring ${packageName} `);
        requestSettings = {
          json: true,
          url: `${config.getAtomPackagesUrl()}/${packageName}/star`,
          headers: {
            authorization: token
          }
        };
        return request.post(requestSettings, (error, response, body = {}) => {
          var message;
          if (error != null) {
            this.logFailure();
            return callback(error);
          } else if (response.statusCode === 404 && ignoreUnpublishedPackages) {
            process.stdout.write('skipped (not published)\n'.yellow);
            return callback();
          } else if (response.statusCode !== 200) {
            this.logFailure();
            message = request.getErrorMessage(response, body);
            return callback(`Starring package failed: ${message}`);
          } else {
            this.logSuccess();
            return callback();
          }
        });
      }

      getInstalledPackageNames() {
        var child, i, installedPackages, len, manifestPath, metadata, ref, ref1, userPackagesDirectory;
        installedPackages = [];
        userPackagesDirectory = path.join(config.getAtomDirectory(), 'packages');
        ref = fs.list(userPackagesDirectory);
        for (i = 0, len = ref.length; i < len; i++) {
          child = ref[i];
          if (!fs.isDirectorySync(path.join(userPackagesDirectory, child))) {
            continue;
          }
          if (manifestPath = CSON.resolve(path.join(userPackagesDirectory, child, 'package'))) {
            try {
              metadata = (ref1 = CSON.readFileSync(manifestPath)) != null ? ref1 : {};
              if (metadata.name && Packages.getRepository(metadata)) {
                installedPackages.push(metadata.name);
              }
            } catch (error1) {}
          }
        }
        return _.uniq(installedPackages);
      }

      run(options) {
        var callback, packageNames;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        if (options.argv.installed) {
          packageNames = this.getInstalledPackageNames();
          if (packageNames.length === 0) {
            callback();
            return;
          }
        } else {
          packageNames = this.packageNamesFromArgv(options.argv);
          if (packageNames.length === 0) {
            callback("Please specify a package name to star");
            return;
          }
        }
        return Login.getTokenOrLogin((error, token) => {
          var commands, starOptions;
          if (error != null) {
            return callback(error);
          }
          starOptions = {
            ignoreUnpublishedPackages: options.argv.installed,
            token: token
          };
          commands = packageNames.map((packageName) => {
            return (callback) => {
              return this.starPackage(packageName, starOptions, callback);
            };
          });
          return async.waterfall(commands, callback);
        });
      }

    };

    Star.commandNames = ['star'];

    return Star;

  }).call(this);

}).call(this);
