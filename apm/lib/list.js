(function() {
  var CSON, Command, List, _, config, fs, getRepository, path, tree, yargs;

  path = require('path');

  _ = require('underscore-plus');

  CSON = require('season');

  yargs = require('yargs');

  Command = require('./command');

  fs = require('./fs');

  config = require('./apm');

  tree = require('./tree');

  ({getRepository} = require("./packages"));

  module.exports = List = (function() {
    class List extends Command {
      constructor() {
        var configPath, ref, ref1, ref2;
        super();
        this.userPackagesDirectory = path.join(config.getAtomDirectory(), 'packages');
        this.devPackagesDirectory = path.join(config.getAtomDirectory(), 'dev', 'packages');
        if (configPath = CSON.resolve(path.join(config.getAtomDirectory(), 'config'))) {
          try {
            this.disabledPackages = (ref = CSON.readFileSync(configPath)) != null ? (ref1 = ref['*']) != null ? (ref2 = ref1.core) != null ? ref2.disabledPackages : void 0 : void 0 : void 0;
          } catch (error1) {}
        }
        if (this.disabledPackages == null) {
          this.disabledPackages = [];
        }
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm list\n       apm list --themes\n       apm list --packages\n       apm list --installed\n       apm list --installed --enabled\n       apm list --installed --bare > my-packages.txt\n       apm list --json\n\nList all the installed packages and also the packages bundled with Atom.");
        options.alias('b', 'bare').boolean('bare').describe('bare', 'Print packages one per line with no formatting');
        options.alias('e', 'enabled').boolean('enabled').describe('enabled', 'Print only enabled packages');
        options.alias('d', 'dev').boolean('dev').default('dev', true).describe('dev', 'Include dev packages');
        options.boolean('disabled').describe('disabled', 'Print only disabled packages');
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.alias('i', 'installed').boolean('installed').describe('installed', 'Only list installed packages/themes');
        options.alias('j', 'json').boolean('json').describe('json', 'Output all packages as a JSON object');
        options.alias('l', 'links').boolean('links').default('links', true).describe('links', 'Include linked packages');
        options.alias('t', 'themes').boolean('themes').describe('themes', 'Only list themes');
        return options.alias('p', 'packages').boolean('packages').describe('packages', 'Only list packages');
      }

      isPackageDisabled(name) {
        return this.disabledPackages.indexOf(name) !== -1;
      }

      logPackages(packages, options) {
        var i, len, pack, packageLine;
        if (options.argv.bare) {
          for (i = 0, len = packages.length; i < len; i++) {
            pack = packages[i];
            packageLine = pack.name;
            if (pack.version != null) {
              packageLine += `@${pack.version}`;
            }
            console.log(packageLine);
          }
        } else {
          tree(packages, (pack) => {
            var ref, repo, shaLine;
            packageLine = pack.name;
            if (pack.version != null) {
              packageLine += `@${pack.version}`;
            }
            if (((ref = pack.apmInstallSource) != null ? ref.type : void 0) === 'git') {
              repo = getRepository(pack);
              shaLine = `#${pack.apmInstallSource.sha.substr(0, 8)}`;
              if (repo != null) {
                shaLine = repo + shaLine;
              }
              packageLine += ` (${shaLine})`.grey;
            }
            if (this.isPackageDisabled(pack.name) && !options.argv.disabled) {
              packageLine += ' (disabled)';
            }
            return packageLine;
          });
        }
        return console.log();
      }

      checkExclusiveOptions(options, positive_option, negative_option, value) {
        if (options.argv[positive_option]) {
          return value;
        } else if (options.argv[negative_option]) {
          return !value;
        } else {
          return true;
        }
      }

      isPackageVisible(options, manifest) {
        return this.checkExclusiveOptions(options, 'themes', 'packages', manifest.theme) && this.checkExclusiveOptions(options, 'disabled', 'enabled', this.isPackageDisabled(manifest.name));
      }

      listPackages(directoryPath, options) {
        var child, i, len, manifest, manifestPath, packages, ref;
        packages = [];
        ref = fs.list(directoryPath);
        for (i = 0, len = ref.length; i < len; i++) {
          child = ref[i];
          if (!fs.isDirectorySync(path.join(directoryPath, child))) {
            continue;
          }
          if (child.match(/^\./)) {
            continue;
          }
          if (!options.argv.links) {
            if (fs.isSymbolicLinkSync(path.join(directoryPath, child))) {
              continue;
            }
          }
          manifest = null;
          if (manifestPath = CSON.resolve(path.join(directoryPath, child, 'package'))) {
            try {
              manifest = CSON.readFileSync(manifestPath);
            } catch (error1) {}
          }
          if (manifest == null) {
            manifest = {};
          }
          manifest.name = child;
          if (!this.isPackageVisible(options, manifest)) {
            continue;
          }
          packages.push(manifest);
        }
        return packages;
      }

      listUserPackages(options, callback) {
        var userPackages;
        userPackages = this.listPackages(this.userPackagesDirectory, options).filter(function(pack) {
          return !pack.apmInstallSource;
        });
        if (!(options.argv.bare || options.argv.json)) {
          console.log(`Community Packages (${userPackages.length})`.cyan, `${this.userPackagesDirectory}`);
        }
        return typeof callback === "function" ? callback(null, userPackages) : void 0;
      }

      listDevPackages(options, callback) {
        var devPackages;
        if (!options.argv.dev) {
          return typeof callback === "function" ? callback(null, []) : void 0;
        }
        devPackages = this.listPackages(this.devPackagesDirectory, options);
        if (devPackages.length > 0) {
          if (!(options.argv.bare || options.argv.json)) {
            console.log(`Dev Packages (${devPackages.length})`.cyan, `${this.devPackagesDirectory}`);
          }
        }
        return typeof callback === "function" ? callback(null, devPackages) : void 0;
      }

      listGitPackages(options, callback) {
        var gitPackages;
        gitPackages = this.listPackages(this.userPackagesDirectory, options).filter(function(pack) {
          var ref;
          return ((ref = pack.apmInstallSource) != null ? ref.type : void 0) === 'git';
        });
        if (gitPackages.length > 0) {
          if (!(options.argv.bare || options.argv.json)) {
            console.log(`Git Packages (${gitPackages.length})`.cyan, `${this.userPackagesDirectory}`);
          }
        }
        return typeof callback === "function" ? callback(null, gitPackages) : void 0;
      }

      listBundledPackages(options, callback) {
        return config.getResourcePath((resourcePath) => {
          var _atomPackages, metadata, metadataPath, packageName, packages;
          try {
            metadataPath = path.join(resourcePath, 'package.json');
            ({_atomPackages} = JSON.parse(fs.readFileSync(metadataPath)));
          } catch (error1) {}
          if (_atomPackages == null) {
            _atomPackages = {};
          }
          packages = (function() {
            var results;
            results = [];
            for (packageName in _atomPackages) {
              ({metadata} = _atomPackages[packageName]);
              results.push(metadata);
            }
            return results;
          })();
          packages = packages.filter((metadata) => {
            return this.isPackageVisible(options, metadata);
          });
          if (!(options.argv.bare || options.argv.json)) {
            if (options.argv.themes) {
              console.log(`${'Built-in Atom Themes'.cyan} (${packages.length})`);
            } else {
              console.log(`${'Built-in Atom Packages'.cyan} (${packages.length})`);
            }
          }
          return typeof callback === "function" ? callback(null, packages) : void 0;
        });
      }

      listInstalledPackages(options) {
        return this.listDevPackages(options, (error, packages) => {
          if (packages.length > 0) {
            this.logPackages(packages, options);
          }
          return this.listUserPackages(options, (error, packages) => {
            this.logPackages(packages, options);
            return this.listGitPackages(options, (error, packages) => {
              if (packages.length > 0) {
                return this.logPackages(packages, options);
              }
            });
          });
        });
      }

      listPackagesAsJson(options, callback = function() {}) {
        var output;
        output = {
          core: [],
          dev: [],
          git: [],
          user: []
        };
        return this.listBundledPackages(options, (error, packages) => {
          if (error) {
            return callback(error);
          }
          output.core = packages;
          return this.listDevPackages(options, (error, packages) => {
            if (error) {
              return callback(error);
            }
            output.dev = packages;
            return this.listUserPackages(options, (error, packages) => {
              if (error) {
                return callback(error);
              }
              output.user = packages;
              return this.listGitPackages(options, function(error, packages) {
                if (error) {
                  return callback(error);
                }
                output.git = packages;
                console.log(JSON.stringify(output));
                return callback();
              });
            });
          });
        });
      }

      run(options) {
        var callback;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        if (options.argv.json) {
          return this.listPackagesAsJson(options, callback);
        } else if (options.argv.installed) {
          this.listInstalledPackages(options);
          return callback();
        } else {
          return this.listBundledPackages(options, (error, packages) => {
            this.logPackages(packages, options);
            this.listInstalledPackages(options);
            return callback();
          });
        }
      }

    };

    List.commandNames = ['list', 'ls'];

    return List;

  }).call(this);

}).call(this);
