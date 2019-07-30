(function() {
  var Command, Links, config, fs, path, tree, yargs;

  path = require('path');

  yargs = require('yargs');

  Command = require('./command');

  config = require('./apm');

  fs = require('./fs');

  tree = require('./tree');

  module.exports = Links = (function() {
    class Links extends Command {
      constructor() {
        super();
        this.devPackagesPath = path.join(config.getAtomDirectory(), 'dev', 'packages');
        this.packagesPath = path.join(config.getAtomDirectory(), 'packages');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm links\n\nList all of the symlinked atom packages in ~/.atom/packages and\n~/.atom/dev/packages.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      getDevPackagePath(packageName) {
        return path.join(this.devPackagesPath, packageName);
      }

      getPackagePath(packageName) {
        return path.join(this.packagesPath, packageName);
      }

      getSymlinks(directoryPath) {
        var directory, i, len, ref, symlinkPath, symlinks;
        symlinks = [];
        ref = fs.list(directoryPath);
        for (i = 0, len = ref.length; i < len; i++) {
          directory = ref[i];
          symlinkPath = path.join(directoryPath, directory);
          if (fs.isSymbolicLinkSync(symlinkPath)) {
            symlinks.push(symlinkPath);
          }
        }
        return symlinks;
      }

      logLinks(directoryPath) {
        var links;
        links = this.getSymlinks(directoryPath);
        console.log(`${directoryPath.cyan} (${links.length})`);
        return tree(links, {
          emptyMessage: '(no links)'
        }, function(link) {
          var error, realpath;
          try {
            realpath = fs.realpathSync(link);
          } catch (error1) {
            error = error1;
            realpath = '???'.red;
          }
          return `${(path.basename(link).yellow)} -> ${realpath}`;
        });
      }

      run(options) {
        var callback;
        ({callback} = options);
        this.logLinks(this.devPackagesPath);
        this.logLinks(this.packagesPath);
        return callback();
      }

    };

    Links.commandNames = ['linked', 'links', 'lns'];

    return Links;

  }).call(this);

}).call(this);
