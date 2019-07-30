(function() {
  var Ci, Command, _, async, config, fs, path, yargs,
    boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

  path = require('path');

  fs = require('./fs');

  yargs = require('yargs');

  async = require('async');

  _ = require('underscore-plus');

  config = require('./apm');

  Command = require('./command');

  module.exports = Ci = (function() {
    class Ci extends Command {
      constructor() {
        super();
        this.installDependencies = this.installDependencies.bind(this);
        this.installNode = this.installNode.bind(this);
        this.atomDirectory = config.getAtomDirectory();
        this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
        this.atomNpmPath = require.resolve('npm/bin/npm-cli');
        this.atomNodeGypPath = process.env.ATOM_NODE_GYP_PATH || require.resolve('node-gyp/bin/node-gyp');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("Usage: apm ci\n\nInstall a package with a clean slate.\n\nIf you have an up-to-date package-lock.json file created by apm install,\napm ci will install its locked contents exactly. It is substantially\nfaster than apm install and produces consistently reproduceable builds,\nbut cannot be used to install new packages or dependencies.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        return options.boolean('verbose').default('verbose', false).describe('verbose', 'Show verbose debug information');
      }

      installDependencies(options, callback) {
        boundMethodCheck(this, Ci);
        return async.waterfall([
          (cb) => {
            return this.installNode(options,
          cb);
          },
          (cb) => {
            return this.installModules(options,
          cb);
          }
        ], callback);
      }

      installNode(options, callback) {
        var env, installNodeArgs, opts, proxy, ref, useStrictSsl;
        boundMethodCheck(this, Ci);
        installNodeArgs = ['install'];
        installNodeArgs.push(...this.getNpmBuildFlags());
        installNodeArgs.push("--ensure");
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: config.getRustupHomeDirPath()
        });
        if (config.isWin32()) {
          env.USERPROFILE = env.HOME;
        }
        fs.makeTreeSync(this.atomDirectory);
        // node-gyp doesn't currently have an option for this so just set the
        // environment variable to bypass strict SSL
        // https://github.com/TooTallNate/node-gyp/issues/448
        useStrictSsl = (ref = this.npm.config.get('strict-ssl')) != null ? ref : true;
        if (!useStrictSsl) {
          env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
        }
        // Pass through configured proxy to node-gyp
        proxy = this.npm.config.get('https-proxy') || this.npm.config.get('proxy') || env.HTTPS_PROXY || env.HTTP_PROXY;
        if (proxy) {
          installNodeArgs.push(`--proxy=${proxy}`);
        }
        opts = {
          env,
          cwd: this.atomDirectory,
          streaming: options.argv.verbose
        };
        return this.fork(this.atomNodeGypPath, installNodeArgs, opts, function(code, stderr = '', stdout = '') {
          if (code === 0) {
            return callback();
          } else {
            return callback(`${stdout}\n${stderr}`);
          }
        });
      }

      installModules(options, callback) {
        var env, installArgs, installOptions, vsArgs;
        process.stdout.write('Installing locked modules');
        if (options.argv.verbose) {
          process.stdout.write('\n');
        } else {
          process.stdout.write(' ');
        }
        installArgs = ['ci', '--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), ...this.getNpmBuildFlags()];
        if (options.argv.verbose) {
          installArgs.push('--verbose');
        }
        if (vsArgs = this.getVisualStudioFlags()) {
          installArgs.push(vsArgs);
        }
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: config.getRustupHomeDirPath()
        });
        if (config.isWin32()) {
          this.updateWindowsEnv(env);
        }
        this.addNodeBinToEnv(env);
        this.addProxyToEnv(env);
        installOptions = {
          env,
          streaming: options.argv.verbose
        };
        return this.fork(this.atomNpmPath, installArgs, installOptions, (...args) => {
          return this.logCommandResults(callback, ...args);
        });
      }

      run(options) {
        var callback, commands, iteratee, opts;
        ({callback} = options);
        opts = this.parseOptions(options.commandArgs);
        commands = [];
        commands.push((callback) => {
          return config.loadNpm((error, npm) => {
            this.npm = npm;
            return callback(error);
          });
        });
        commands.push((cb) => {
          return this.loadInstalledAtomMetadata(cb);
        });
        commands.push((cb) => {
          return this.installDependencies(opts, cb);
        });
        iteratee = function(item, next) {
          return item(next);
        };
        return async.mapSeries(commands, iteratee, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      }

    };

    Ci.commandNames = ['ci'];

    return Ci;

  }).call(this);

}).call(this);
