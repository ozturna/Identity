(function() {
  var CSON, Command, Disable, List, _, config, path, yargs;

  _ = require('underscore-plus');

  path = require('path');

  CSON = require('season');

  yargs = require('yargs');

  config = require('./apm');

  Command = require('./command');

  List = require('./list');

  module.exports = Disable = (function() {
    class Disable extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm disable [<package_name>]...\n\nDisables the named package(s).");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      getInstalledPackages(callback) {
        var lister, options;
        options = {
          argv: {
            theme: false,
            bare: true
          }
        };
        lister = new List();
        return lister.listBundledPackages(options, function(error, core_packages) {
          return lister.listDevPackages(options, function(error, dev_packages) {
            return lister.listUserPackages(options, function(error, user_packages) {
              return callback(null, core_packages.concat(dev_packages, user_packages));
            });
          });
        });
      }

      run(options) {
        var callback, configFilePath, error, packageNames, settings;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        packageNames = this.packageNamesFromArgv(options.argv);
        configFilePath = CSON.resolve(path.join(config.getAtomDirectory(), 'config'));
        if (!configFilePath) {
          callback("Could not find config.cson. Run Atom first?");
          return;
        }
        try {
          settings = CSON.readFileSync(configFilePath);
        } catch (error1) {
          error = error1;
          callback(`Failed to load \`${configFilePath}\`: ${error.message}`);
          return;
        }
        return this.getInstalledPackages((error, installedPackages) => {
          var disabledPackages, installedPackageNames, keyPath, pkg, ref, result, uninstalledPackageNames;
          if (error) {
            return callback(error);
          }
          installedPackageNames = (function() {
            var i, len, results;
            results = [];
            for (i = 0, len = installedPackages.length; i < len; i++) {
              pkg = installedPackages[i];
              results.push(pkg.name);
            }
            return results;
          })();
          // uninstalledPackages = (name for name in packageNames when !installedPackageNames[name])
          uninstalledPackageNames = _.difference(packageNames, installedPackageNames);
          if (uninstalledPackageNames.length > 0) {
            console.log(`Not Installed:\n  ${uninstalledPackageNames.join('\n  ')}`);
          }
          // only installed packages can be disabled
          packageNames = _.difference(packageNames, uninstalledPackageNames);
          if (packageNames.length === 0) {
            callback("Please specify a package to disable");
            return;
          }
          keyPath = '*.core.disabledPackages';
          disabledPackages = (ref = _.valueForKeyPath(settings, keyPath)) != null ? ref : [];
          result = _.union(disabledPackages, packageNames);
          _.setValueForKeyPath(settings, keyPath, result);
          try {
            CSON.writeFileSync(configFilePath, settings);
          } catch (error1) {
            error = error1;
            callback(`Failed to save \`${configFilePath}\`: ${error.message}`);
            return;
          }
          console.log(`Disabled:\n  ${packageNames.join('\n  ')}`);
          this.logSuccess();
          return callback();
        });
      }

    };

    Disable.commandNames = ['disable'];

    return Disable;

  }).call(this);

}).call(this);
