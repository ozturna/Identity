(function() {
  var Command, _, child_process, config, git, path, semver;

  child_process = require('child_process');

  path = require('path');

  _ = require('underscore-plus');

  semver = require('semver');

  config = require('./apm');

  git = require('./git');

  module.exports = Command = class Command {
    constructor() {
      this.logCommandResults = this.logCommandResults.bind(this);
      this.logCommandResultsIfFail = this.logCommandResultsIfFail.bind(this);
    }

    spawn(command, args, ...remaining) {
      var callback, errorChunks, onChildExit, options, outputChunks, spawned;
      if (remaining.length >= 2) {
        options = remaining.shift();
      }
      callback = remaining.shift();
      spawned = child_process.spawn(command, args, options);
      errorChunks = [];
      outputChunks = [];
      spawned.stdout.on('data', function(chunk) {
        if (options != null ? options.streaming : void 0) {
          return process.stdout.write(chunk);
        } else {
          return outputChunks.push(chunk);
        }
      });
      spawned.stderr.on('data', function(chunk) {
        if (options != null ? options.streaming : void 0) {
          return process.stderr.write(chunk);
        } else {
          return errorChunks.push(chunk);
        }
      });
      onChildExit = function(errorOrExitCode) {
        spawned.removeListener('error', onChildExit);
        spawned.removeListener('close', onChildExit);
        return typeof callback === "function" ? callback(errorOrExitCode, Buffer.concat(errorChunks).toString(), Buffer.concat(outputChunks).toString()) : void 0;
      };
      spawned.on('error', onChildExit);
      spawned.on('close', onChildExit);
      return spawned;
    }

    fork(script, args, ...remaining) {
      args.unshift(script);
      return this.spawn(process.execPath, args, ...remaining);
    }

    packageNamesFromArgv(argv) {
      return this.sanitizePackageNames(argv._);
    }

    sanitizePackageNames(packageNames = []) {
      packageNames = packageNames.map(function(packageName) {
        return packageName.trim();
      });
      return _.compact(_.uniq(packageNames));
    }

    logSuccess() {
      if (process.platform === 'win32') {
        return process.stdout.write('done\n'.green);
      } else {
        return process.stdout.write('\u2713\n'.green);
      }
    }

    logFailure() {
      if (process.platform === 'win32') {
        return process.stdout.write('failed\n'.red);
      } else {
        return process.stdout.write('\u2717\n'.red);
      }
    }

    logCommandResults(callback, code, stderr = '', stdout = '') {
      if (code === 0) {
        this.logSuccess();
        return callback();
      } else {
        this.logFailure();
        return callback(`${stdout}\n${stderr}`.trim());
      }
    }

    logCommandResultsIfFail(callback, code, stderr = '', stdout = '') {
      if (code === 0) {
        return callback();
      } else {
        this.logFailure();
        return callback(`${stdout}\n${stderr}`.trim());
      }
    }

    normalizeVersion(version) {
      if (typeof version === 'string') {
        // Remove commit SHA suffix
        return version.replace(/-.*$/, '');
      } else {
        return version;
      }
    }

    loadInstalledAtomMetadata(callback) {
      return this.getResourcePath((resourcePath) => {
        var electronVersion, ref, ref1, version;
        try {
          ({version, electronVersion} = (ref = require(path.join(resourcePath, 'package.json'))) != null ? ref : {});
          version = this.normalizeVersion(version);
          if (semver.valid(version)) {
            this.installedAtomVersion = version;
          }
        } catch (error) {}
        this.electronVersion = (ref1 = process.env.ATOM_ELECTRON_VERSION) != null ? ref1 : electronVersion;
        if (this.electronVersion == null) {
          throw new Error('Could not determine Electron version');
        }
        return callback();
      });
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

    addBuildEnvVars(env) {
      if (config.isWin32()) {
        this.updateWindowsEnv(env);
      }
      this.addNodeBinToEnv(env);
      return this.addProxyToEnv(env);
    }

    getVisualStudioFlags() {
      var vsVersion;
      if (vsVersion = config.getInstalledVisualStudioFlag()) {
        return `--msvs_version=${vsVersion}`;
      }
    }

    getNpmBuildFlags() {
      return ["--runtime=electron", `--target=${this.electronVersion}`, `--dist-url=${config.getElectronUrl()}`, `--arch=${config.getElectronArch()}`];
    }

    updateWindowsEnv(env) {
      var localModuleBins;
      env.USERPROFILE = env.HOME;
      // Make sure node-gyp is always on the PATH
      localModuleBins = path.resolve(__dirname, '..', 'node_modules', '.bin');
      if (env.Path) {
        env.Path += `${path.delimiter}${localModuleBins}`;
      } else {
        env.Path = localModuleBins;
      }
      return git.addGitToEnv(env);
    }

    addNodeBinToEnv(env) {
      var nodeBinFolder, pathKey;
      nodeBinFolder = path.resolve(__dirname, '..', 'bin');
      pathKey = config.isWin32() ? 'Path' : 'PATH';
      if (env[pathKey]) {
        return env[pathKey] = `${nodeBinFolder}${path.delimiter}${env[pathKey]}`;
      } else {
        return env[pathKey] = nodeBinFolder;
      }
    }

    addProxyToEnv(env) {
      var httpProxy, httpsProxy;
      httpProxy = this.npm.config.get('proxy');
      if (httpProxy) {
        if (env.HTTP_PROXY == null) {
          env.HTTP_PROXY = httpProxy;
        }
        if (env.http_proxy == null) {
          env.http_proxy = httpProxy;
        }
      }
      httpsProxy = this.npm.config.get('https-proxy');
      if (httpsProxy) {
        if (env.HTTPS_PROXY == null) {
          env.HTTPS_PROXY = httpsProxy;
        }
        return env.https_proxy != null ? env.https_proxy : env.https_proxy = httpsProxy;
      }
    }

  };

}).call(this);
