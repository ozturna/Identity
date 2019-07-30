(function() {
  var Command, Dedupe, _, async, config, fs, path, yargs;

  path = require('path');

  async = require('async');

  _ = require('underscore-plus');

  yargs = require('yargs');

  config = require('./apm');

  Command = require('./command');

  fs = require('./fs');

  module.exports = Dedupe = (function() {
    class Dedupe extends Command {
      constructor() {
        super();
        this.atomDirectory = config.getAtomDirectory();
        this.atomPackagesDirectory = path.join(this.atomDirectory, 'packages');
        this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
        this.atomNpmPath = require.resolve('npm/bin/npm-cli');
        this.atomNodeGypPath = require.resolve('node-gyp/bin/node-gyp');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm dedupe [<package_name>...]\n\nReduce duplication in the node_modules folder in the current directory.\n\nThis command is experimental.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      installNode(callback) {
        var env, installNodeArgs;
        installNodeArgs = ['install'];
        installNodeArgs.push(...this.getNpmBuildFlags());
        installNodeArgs.push('--ensure');
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: config.getRustupHomeDirPath()
        });
        if (config.isWin32()) {
          env.USERPROFILE = env.HOME;
        }
        fs.makeTreeSync(this.atomDirectory);
        return config.loadNpm((error, npm) => {
          var proxy, ref, useStrictSsl;
          // node-gyp doesn't currently have an option for this so just set the
          // environment variable to bypass strict SSL
          // https://github.com/TooTallNate/node-gyp/issues/448
          useStrictSsl = (ref = npm.config.get('strict-ssl')) != null ? ref : true;
          if (!useStrictSsl) {
            env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
          }
          // Pass through configured proxy to node-gyp
          proxy = npm.config.get('https-proxy') || npm.config.get('proxy') || env.HTTPS_PROXY || env.HTTP_PROXY;
          if (proxy) {
            installNodeArgs.push(`--proxy=${proxy}`);
          }
          return this.fork(this.atomNodeGypPath, installNodeArgs, {
            env,
            cwd: this.atomDirectory
          }, function(code, stderr = '', stdout = '') {
            if (code === 0) {
              return callback();
            } else {
              return callback(`${stdout}\n${stderr}`);
            }
          });
        });
      }

      getVisualStudioFlags() {
        var vsVersion;
        if (vsVersion = config.getInstalledVisualStudioFlag()) {
          return `--msvs_version=${vsVersion}`;
        }
      }

      dedupeModules(options, callback) {
        process.stdout.write('Deduping modules ');
        return this.forkDedupeCommand(options, (...args) => {
          return this.logCommandResults(callback, ...args);
        });
      }

      forkDedupeCommand(options, callback) {
        var dedupeArgs, dedupeOptions, env, i, len, packageName, ref, vsArgs;
        dedupeArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'dedupe'];
        dedupeArgs.push(...this.getNpmBuildFlags());
        if (options.argv.silent) {
          dedupeArgs.push('--silent');
        }
        if (options.argv.quiet) {
          dedupeArgs.push('--quiet');
        }
        if (vsArgs = this.getVisualStudioFlags()) {
          dedupeArgs.push(vsArgs);
        }
        ref = options.argv._;
        for (i = 0, len = ref.length; i < len; i++) {
          packageName = ref[i];
          dedupeArgs.push(packageName);
        }
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: config.getRustupHomeDirPath()
        });
        if (config.isWin32()) {
          env.USERPROFILE = env.HOME;
        }
        dedupeOptions = {env};
        if (options.cwd) {
          dedupeOptions.cwd = options.cwd;
        }
        return this.fork(this.atomNpmPath, dedupeArgs, dedupeOptions, callback);
      }

      createAtomDirectories() {
        fs.makeTreeSync(this.atomDirectory);
        return fs.makeTreeSync(this.atomNodeDirectory);
      }

      run(options) {
        var callback, commands, cwd;
        ({callback, cwd} = options);
        options = this.parseOptions(options.commandArgs);
        options.cwd = cwd;
        this.createAtomDirectories();
        commands = [];
        commands.push((callback) => {
          return this.loadInstalledAtomMetadata(callback);
        });
        commands.push((callback) => {
          return this.installNode(callback);
        });
        commands.push((callback) => {
          return this.dedupeModules(options, callback);
        });
        return async.waterfall(commands, callback);
      }

    };

    Dedupe.commandNames = ['dedupe'];

    return Dedupe;

  }).call(this);

}).call(this);
