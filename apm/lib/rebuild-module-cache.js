(function() {
  var Command, RebuildModuleCache, async, config, fs, path, yargs;

  path = require('path');

  async = require('async');

  yargs = require('yargs');

  Command = require('./command');

  config = require('./apm');

  fs = require('./fs');

  module.exports = RebuildModuleCache = (function() {
    class RebuildModuleCache extends Command {
      constructor() {
        super();
        this.atomPackagesDirectory = path.join(config.getAtomDirectory(), 'packages');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm rebuild-module-cache\n\nRebuild the module cache for all the packages installed to\n~/.atom/packages\n\nYou can see the state of the module cache for a package by looking\nat the _atomModuleCache property in the package's package.json file.\n\nThis command skips all linked packages.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      getResourcePath(callback) {
        if (this.resourcePath) {
          return process.nextTick(() => {
            return callback(this.resourcePath);
          });
        } else {
          return config.getResourcePath((resourcePath1) => {
            this.resourcePath = resourcePath1;
            return callback(this.resourcePath);
          });
        }
      }

      rebuild(packageDirectory, callback) {
        return this.getResourcePath((resourcePath) => {
          var error;
          try {
            if (this.moduleCache == null) {
              this.moduleCache = require(path.join(resourcePath, 'src', 'module-cache'));
            }
            this.moduleCache.create(packageDirectory);
          } catch (error1) {
            error = error1;
            return callback(error);
          }
          return callback();
        });
      }

      run(options) {
        var callback, commands;
        ({callback} = options);
        commands = [];
        fs.list(this.atomPackagesDirectory).forEach((packageName) => {
          var packageDirectory;
          packageDirectory = path.join(this.atomPackagesDirectory, packageName);
          if (fs.isSymbolicLinkSync(packageDirectory)) {
            return;
          }
          if (!fs.isFileSync(path.join(packageDirectory, 'package.json'))) {
            return;
          }
          return commands.push((callback) => {
            process.stdout.write(`Rebuilding ${packageName} module cache `);
            return this.rebuild(packageDirectory, (error) => {
              if (error != null) {
                this.logFailure();
              } else {
                this.logSuccess();
              }
              return callback(error);
            });
          });
        });
        return async.waterfall(commands, callback);
      }

    };

    RebuildModuleCache.commandNames = ['rebuild-module-cache'];

    return RebuildModuleCache;

  }).call(this);

}).call(this);
