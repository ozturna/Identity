(function() {
  var CSON, Command, Unlink, config, fs, path, yargs;

  path = require('path');

  CSON = require('season');

  yargs = require('yargs');

  Command = require('./command');

  config = require('./apm');

  fs = require('./fs');

  module.exports = Unlink = (function() {
    class Unlink extends Command {
      constructor() {
        super();
        this.devPackagesPath = path.join(config.getAtomDirectory(), 'dev', 'packages');
        this.packagesPath = path.join(config.getAtomDirectory(), 'packages');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm unlink [<package_path>]\n\nDelete the symlink in ~/.atom/packages for the package. The package in the\ncurrent working directory is unlinked if no path is given.\n\nRun `apm links` to view all the currently linked packages.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.alias('d', 'dev').boolean('dev').describe('dev', 'Unlink package from ~/.atom/dev/packages');
        options.boolean('hard').describe('hard', 'Unlink package from ~/.atom/packages and ~/.atom/dev/packages');
        return options.alias('a', 'all').boolean('all').describe('all', 'Unlink all packages in ~/.atom/packages and ~/.atom/dev/packages');
      }

      getDevPackagePath(packageName) {
        return path.join(this.devPackagesPath, packageName);
      }

      getPackagePath(packageName) {
        return path.join(this.packagesPath, packageName);
      }

      unlinkPath(pathToUnlink) {
        var error;
        try {
          process.stdout.write(`Unlinking ${pathToUnlink} `);
          if (fs.isSymbolicLinkSync(pathToUnlink)) {
            fs.unlinkSync(pathToUnlink);
          }
          return this.logSuccess();
        } catch (error1) {
          error = error1;
          this.logFailure();
          throw error;
        }
      }

      unlinkAll(options, callback) {
        var child, error, i, j, len, len1, packagePath, ref, ref1;
        try {
          ref = fs.list(this.devPackagesPath);
          for (i = 0, len = ref.length; i < len; i++) {
            child = ref[i];
            packagePath = path.join(this.devPackagesPath, child);
            if (fs.isSymbolicLinkSync(packagePath)) {
              this.unlinkPath(packagePath);
            }
          }
          if (!options.argv.dev) {
            ref1 = fs.list(this.packagesPath);
            for (j = 0, len1 = ref1.length; j < len1; j++) {
              child = ref1[j];
              packagePath = path.join(this.packagesPath, child);
              if (fs.isSymbolicLinkSync(packagePath)) {
                this.unlinkPath(packagePath);
              }
            }
          }
          return callback();
        } catch (error1) {
          error = error1;
          return callback(error);
        }
      }

      unlinkPackage(options, callback) {
        var error, linkPath, packageName, packagePath, ref, ref1, targetPath;
        packagePath = (ref = (ref1 = options.argv._[0]) != null ? ref1.toString() : void 0) != null ? ref : '.';
        linkPath = path.resolve(process.cwd(), packagePath);
        try {
          packageName = CSON.readFileSync(CSON.resolve(path.join(linkPath, 'package'))).name;
        } catch (error1) {}
        if (!packageName) {
          packageName = path.basename(linkPath);
        }
        if (options.argv.hard) {
          try {
            this.unlinkPath(this.getDevPackagePath(packageName));
            this.unlinkPath(this.getPackagePath(packageName));
            return callback();
          } catch (error1) {
            error = error1;
            return callback(error);
          }
        } else {
          if (options.argv.dev) {
            targetPath = this.getDevPackagePath(packageName);
          } else {
            targetPath = this.getPackagePath(packageName);
          }
          try {
            this.unlinkPath(targetPath);
            return callback();
          } catch (error1) {
            error = error1;
            return callback(error);
          }
        }
      }

      run(options) {
        var callback;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        if (options.argv.all) {
          return this.unlinkAll(options, callback);
        } else {
          return this.unlinkPackage(options, callback);
        }
      }

    };

    Unlink.commandNames = ['unlink'];

    return Unlink;

  }).call(this);

}).call(this);
