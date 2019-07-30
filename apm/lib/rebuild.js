(function() {
  var Command, Install, Rebuild, _, config, path, yargs;

  path = require('path');

  _ = require('underscore-plus');

  yargs = require('yargs');

  config = require('./apm');

  Command = require('./command');

  Install = require('./install');

  module.exports = Rebuild = (function() {
    class Rebuild extends Command {
      constructor() {
        super();
        this.atomNodeDirectory = path.join(config.getAtomDirectory(), '.node-gyp');
        this.atomNpmPath = require.resolve('npm/bin/npm-cli');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm rebuild [<name> [<name> ...]]\n\nRebuild the given modules currently installed in the node_modules folder\nin the current working directory.\n\nAll the modules will be rebuilt if no module names are specified.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      installNode(callback) {
        return config.loadNpm(function(error, npm) {
          var install;
          install = new Install();
          install.npm = npm;
          return install.loadInstalledAtomMetadata(function() {
            return install.installNode(callback);
          });
        });
      }

      forkNpmRebuild(options, callback) {
        var env, rebuildArgs, vsArgs;
        process.stdout.write('Rebuilding modules ');
        rebuildArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'rebuild'];
        rebuildArgs.push(...this.getNpmBuildFlags());
        rebuildArgs.push(...options.argv._);
        if (vsArgs = this.getVisualStudioFlags()) {
          rebuildArgs.push(vsArgs);
        }
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: config.getRustupHomeDirPath()
        });
        if (config.isWin32()) {
          env.USERPROFILE = env.HOME;
        }
        this.addBuildEnvVars(env);
        return this.fork(this.atomNpmPath, rebuildArgs, {env}, callback);
      }

      run(options) {
        var callback;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        return config.loadNpm((error, npm1) => {
          this.npm = npm1;
          return this.loadInstalledAtomMetadata(() => {
            return this.installNode((error) => {
              if (error != null) {
                return callback(error);
              }
              return this.forkNpmRebuild(options, (code, stderr = '') => {
                if (code === 0) {
                  this.logSuccess();
                  return callback();
                } else {
                  this.logFailure();
                  return callback(stderr);
                }
              });
            });
          });
        });
      }

    };

    Rebuild.commandNames = ['rebuild'];

    return Rebuild;

  }).call(this);

}).call(this);
