(function() {
  var CSON, Command, Git, Install, RebuildModuleCache, _, assert, async, config, fs, hostedGitInfo, isDeprecatedPackage, path, request, semver, temp, yargs,
    boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

  assert = require('assert');

  path = require('path');

  _ = require('underscore-plus');

  async = require('async');

  CSON = require('season');

  yargs = require('yargs');

  Git = require('git-utils');

  semver = require('semver');

  temp = require('temp');

  hostedGitInfo = require('hosted-git-info');

  config = require('./apm');

  Command = require('./command');

  fs = require('./fs');

  RebuildModuleCache = require('./rebuild-module-cache');

  request = require('./request');

  ({isDeprecatedPackage} = require('./deprecated-packages'));

  module.exports = Install = (function() {
    class Install extends Command {
      constructor() {
        super();
        this.installNode = this.installNode.bind(this);
        this.installModules = this.installModules.bind(this);
        this.installGitPackageDependencies = this.installGitPackageDependencies.bind(this);
        this.atomDirectory = config.getAtomDirectory();
        this.atomPackagesDirectory = path.join(this.atomDirectory, 'packages');
        this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
        this.atomNpmPath = require.resolve('npm/bin/npm-cli');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm install [<package_name>...]\n       apm install <package_name>@<package_version>\n       apm install <git_remote>\n       apm install <github_username>/<github_project>\n       apm install --packages-file my-packages.txt\n       apm i (with any of the previous argument usage)\n\nInstall the given Atom package to ~/.atom/packages/<package_name>.\n\nIf no package name is given then all the dependencies in the package.json\nfile are installed to the node_modules folder in the current working\ndirectory.\n\nA packages file can be specified that is a newline separated list of\npackage names to install with optional versions using the\n`package-name@version` syntax.");
        options.alias('c', 'compatible').string('compatible').describe('compatible', 'Only install packages/themes compatible with this Atom version');
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.alias('s', 'silent').boolean('silent').describe('silent', 'Set the npm log level to silent');
        options.alias('q', 'quiet').boolean('quiet').describe('quiet', 'Set the npm log level to warn');
        options.boolean('check').describe('check', 'Check that native build tools are installed');
        options.boolean('verbose').default('verbose', false).describe('verbose', 'Show verbose debug information');
        options.string('packages-file').describe('packages-file', 'A text file containing the packages to install');
        return options.boolean('production').describe('production', 'Do not install dev dependencies');
      }

      installNode(callback) {
        var atomNodeGypPath, env, installNodeArgs, opts, proxy, ref, useStrictSsl;
        boundMethodCheck(this, Install);
        installNodeArgs = ['install'];
        installNodeArgs.push(...this.getNpmBuildFlags());
        installNodeArgs.push("--ensure");
        if (this.verbose) {
          installNodeArgs.push("--verbose");
        }
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
          cwd: this.atomDirectory
        };
        if (this.verbose) {
          opts.streaming = true;
        }
        atomNodeGypPath = process.env.ATOM_NODE_GYP_PATH || require.resolve('node-gyp/bin/node-gyp');
        return this.fork(atomNodeGypPath, installNodeArgs, opts, function(code, stderr = '', stdout = '') {
          if (code === 0) {
            return callback();
          } else {
            return callback(`${stdout}\n${stderr}`);
          }
        });
      }

      installModule(options, pack, moduleURI, callback) {
        var env, installArgs, installDirectory, installGlobally, installOptions, nodeModulesDirectory, ref, vsArgs;
        installGlobally = (ref = options.installGlobally) != null ? ref : true;
        installArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'install'];
        installArgs.push(moduleURI);
        installArgs.push(...this.getNpmBuildFlags());
        if (installGlobally) {
          installArgs.push("--global-style");
        }
        if (options.argv.silent) {
          installArgs.push('--silent');
        }
        if (options.argv.quiet) {
          installArgs.push('--quiet');
        }
        if (options.argv.production) {
          installArgs.push('--production');
        }
        if (vsArgs = this.getVisualStudioFlags()) {
          installArgs.push(vsArgs);
        }
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: config.getRustupHomeDirPath()
        });
        this.addBuildEnvVars(env);
        installOptions = {env};
        if (this.verbose) {
          installOptions.streaming = true;
        }
        if (installGlobally) {
          installDirectory = temp.mkdirSync('apm-install-dir-');
          nodeModulesDirectory = path.join(installDirectory, 'node_modules');
          fs.makeTreeSync(nodeModulesDirectory);
          installOptions.cwd = installDirectory;
        }
        return this.fork(this.atomNpmPath, installArgs, installOptions, (code, stderr = '', stdout = '') => {
          var child, children, commands, destination, error, source;
          if (code === 0) {
            if (installGlobally) {
              commands = [];
              children = fs.readdirSync(nodeModulesDirectory).filter(function(dir) {
                return dir !== ".bin";
              });
              assert.equal(children.length, 1, "Expected there to only be one child in node_modules");
              child = children[0];
              source = path.join(nodeModulesDirectory, child);
              destination = path.join(this.atomPackagesDirectory, child);
              commands.push(function(next) {
                return fs.cp(source, destination, next);
              });
              commands.push((next) => {
                return this.buildModuleCache(pack.name, next);
              });
              commands.push((next) => {
                return this.warmCompileCache(pack.name, next);
              });
              return async.waterfall(commands, (error) => {
                if (error != null) {
                  this.logFailure();
                } else {
                  if (!options.argv.json) {
                    this.logSuccess();
                  }
                }
                return callback(error, {
                  name: child,
                  installPath: destination
                });
              });
            } else {
              return callback(null, {
                name: child,
                installPath: destination
              });
            }
          } else {
            if (installGlobally) {
              fs.removeSync(installDirectory);
              this.logFailure();
            }
            error = `${stdout}\n${stderr}`;
            if (error.indexOf('code ENOGIT') !== -1) {
              error = this.getGitErrorMessage(pack);
            }
            return callback(error);
          }
        });
      }

      getGitErrorMessage(pack) {
        var message;
        message = `Failed to install ${pack.name} because Git was not found.\n\nThe ${pack.name} package has module dependencies that cannot be installed without Git.\n\nYou need to install Git and add it to your path environment variable in order to install this package.\n`;
        switch (process.platform) {
          case 'win32':
            message += "\nYou can install Git by downloading, installing, and launching GitHub for Windows: https://windows.github.com\n";
            break;
          case 'linux':
            message += "\nYou can install Git from your OS package manager.\n";
        }
        message += "\nRun apm -v after installing Git to see what version has been detected.";
        return message;
      }

      installModules(options, callback) {
        boundMethodCheck(this, Install);
        if (!options.argv.json) {
          process.stdout.write('Installing modules ');
        }
        return this.forkInstallCommand(options, (...args) => {
          if (options.argv.json) {
            return this.logCommandResultsIfFail(callback, ...args);
          } else {
            return this.logCommandResults(callback, ...args);
          }
        });
      }

      forkInstallCommand(options, callback) {
        var env, installArgs, installOptions, vsArgs;
        installArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'install'];
        installArgs.push(...this.getNpmBuildFlags());
        if (options.argv.silent) {
          installArgs.push('--silent');
        }
        if (options.argv.quiet) {
          installArgs.push('--quiet');
        }
        if (options.argv.production) {
          installArgs.push('--production');
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
        installOptions = {env};
        if (options.cwd) {
          installOptions.cwd = options.cwd;
        }
        if (this.verbose) {
          installOptions.streaming = true;
        }
        return this.fork(this.atomNpmPath, installArgs, installOptions, callback);
      }

      // Request package information from the atom.io API for a given package name.

      // packageName - The string name of the package to request.
      // callback - The function to invoke when the request completes with an error
      //            as the first argument and an object as the second.
      requestPackage(packageName, callback) {
        var requestSettings;
        requestSettings = {
          url: `${config.getAtomPackagesUrl()}/${packageName}`,
          json: true,
          retries: 4
        };
        return request.get(requestSettings, function(error, response, body = {}) {
          var message;
          if (error != null) {
            message = `Request for package information failed: ${error.message}`;
            if (error.code) {
              message += ` (${error.code})`;
            }
            return callback(message);
          } else if (response.statusCode !== 200) {
            message = request.getErrorMessage(response, body);
            return callback(`Request for package information failed: ${message}`);
          } else {
            if (body.releases.latest) {
              return callback(null, body);
            } else {
              return callback(`No releases available for ${packageName}`);
            }
          }
        });
      }

      // Is the package at the specified version already installed?

      //  * packageName: The string name of the package.
      //  * packageVersion: The string version of the package.
      isPackageInstalled(packageName, packageVersion) {
        var error, ref, version;
        try {
          ({version} = (ref = CSON.readFileSync(CSON.resolve(path.join('node_modules', packageName, 'package')))) != null ? ref : {});
          return packageVersion === version;
        } catch (error1) {
          error = error1;
          return false;
        }
      }

      // Install the package with the given name and optional version

      // metadata - The package metadata object with at least a name key. A version
      //            key is also supported. The version defaults to the latest if
      //            unspecified.
      // options - The installation options object.
      // callback - The function to invoke when installation completes with an
      //            error as the first argument.
      installRegisteredPackage(metadata, options, callback) {
        var installGlobally, label, packageName, packageVersion, ref;
        packageName = metadata.name;
        packageVersion = metadata.version;
        installGlobally = (ref = options.installGlobally) != null ? ref : true;
        if (!installGlobally) {
          if (packageVersion && this.isPackageInstalled(packageName, packageVersion)) {
            callback(null, {});
            return;
          }
        }
        label = packageName;
        if (packageVersion) {
          label += `@${packageVersion}`;
        }
        if (!options.argv.json) {
          process.stdout.write(`Installing ${label} `);
          if (installGlobally) {
            process.stdout.write(`to ${this.atomPackagesDirectory} `);
          }
        }
        return this.requestPackage(packageName, (error, pack) => {
          var commands, installNode, ref1, ref2, ref3, tarball;
          if (error != null) {
            this.logFailure();
            return callback(error);
          } else {
            if (packageVersion == null) {
              packageVersion = this.getLatestCompatibleVersion(pack);
            }
            if (!packageVersion) {
              this.logFailure();
              callback(`No available version compatible with the installed Atom version: ${this.installedAtomVersion}`);
              return;
            }
            ({tarball} = (ref1 = (ref2 = pack.versions[packageVersion]) != null ? ref2.dist : void 0) != null ? ref1 : {});
            if (!tarball) {
              this.logFailure();
              callback(`Package version: ${packageVersion} not found`);
              return;
            }
            commands = [];
            installNode = (ref3 = options.installNode) != null ? ref3 : true;
            if (installNode) {
              commands.push(this.installNode);
            }
            commands.push((next) => {
              return this.installModule(options, pack, tarball, next);
            });
            if (installGlobally && (packageName.localeCompare(pack.name, 'en', {
              sensitivity: 'accent'
            }) !== 0)) {
              commands.push((newPack, next) => { // package was renamed; delete old package folder
                fs.removeSync(path.join(this.atomPackagesDirectory, packageName));
                return next(null, newPack);
              });
            }
            commands.push(function({installPath}, next) {
              var json;
              if (installPath != null) {
                metadata = JSON.parse(fs.readFileSync(path.join(installPath, 'package.json'), 'utf8'));
                json = {installPath, metadata};
                return next(null, json);
              } else {
                return next(null, {}); // installed locally, no install path data
              }
            });
            return async.waterfall(commands, (error, json) => {
              if (!installGlobally) {
                if (error != null) {
                  this.logFailure();
                } else {
                  if (!options.argv.json) {
                    this.logSuccess();
                  }
                }
              }
              return callback(error, json);
            });
          }
        });
      }

      // Install the package with the given name and local path

      // packageName - The name of the package
      // packagePath - The local path of the package in the form "file:./packages/package-name"
      // options     - The installation options object.
      // callback    - The function to invoke when installation completes with an
      //               error as the first argument.
      installLocalPackage(packageName, packagePath, options, callback) {
        var commands;
        if (!options.argv.json) {
          process.stdout.write(`Installing ${packageName} from ${packagePath.slice('file:'.length)} `);
          commands = [];
          commands.push((next) => {
            return this.installModule(options, {
              name: packageName
            }, packagePath, next);
          });
          commands.push(function({installPath}, next) {
            var json, metadata;
            if (installPath != null) {
              metadata = JSON.parse(fs.readFileSync(path.join(installPath, 'package.json'), 'utf8'));
              json = {installPath, metadata};
              return next(null, json);
            } else {
              return next(null, {}); // installed locally, no install path data
            }
          });
          return async.waterfall(commands, (error, json) => {
            if (error != null) {
              this.logFailure();
            } else {
              if (!options.argv.json) {
                this.logSuccess();
              }
            }
            return callback(error, json);
          });
        }
      }

      // Install all the package dependencies found in the package.json file.

      // options - The installation options
      // callback - The callback function to invoke when done with an error as the
      //            first argument.
      installPackageDependencies(options, callback) {
        var commands, name, ref, version;
        options = _.extend({}, options, {
          installGlobally: false,
          installNode: false
        });
        commands = [];
        ref = this.getPackageDependencies();
        for (name in ref) {
          version = ref[name];
          ((name, version) => {
            return commands.push((next) => {
              if (version.startsWith('file:.')) {
                return this.installLocalPackage(name, version, options, next);
              } else {
                return this.installRegisteredPackage({name, version}, options, next);
              }
            });
          })(name, version);
        }
        return async.series(commands, callback);
      }

      installDependencies(options, callback) {
        var commands;
        options.installGlobally = false;
        commands = [];
        commands.push(this.installNode);
        commands.push((callback) => {
          return this.installModules(options, callback);
        });
        commands.push((callback) => {
          return this.installPackageDependencies(options, callback);
        });
        return async.waterfall(commands, callback);
      }

      // Get all package dependency names and versions from the package.json file.
      getPackageDependencies() {
        var error, metadata, packageDependencies, ref;
        try {
          metadata = fs.readFileSync('package.json', 'utf8');
          ({packageDependencies} = (ref = JSON.parse(metadata)) != null ? ref : {});
          return packageDependencies != null ? packageDependencies : {};
        } catch (error1) {
          error = error1;
          return {};
        }
      }

      createAtomDirectories() {
        fs.makeTreeSync(this.atomDirectory);
        fs.makeTreeSync(this.atomPackagesDirectory);
        return fs.makeTreeSync(this.atomNodeDirectory);
      }

      // Compile a sample native module to see if a useable native build toolchain
      // is instlalled and successfully detected. This will include both Python
      // and a compiler.
      checkNativeBuildTools(callback) {
        process.stdout.write('Checking for native build tools ');
        return this.installNode((error) => {
          var buildArgs, buildOptions, env, vsArgs;
          if (error != null) {
            this.logFailure();
            return callback(error);
          }
          buildArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'build'];
          buildArgs.push(path.resolve(__dirname, '..', 'native-module'));
          buildArgs.push(...this.getNpmBuildFlags());
          if (vsArgs = this.getVisualStudioFlags()) {
            buildArgs.push(vsArgs);
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
          buildOptions = {env};
          if (this.verbose) {
            buildOptions.streaming = true;
          }
          fs.removeSync(path.resolve(__dirname, '..', 'native-module', 'build'));
          return this.fork(this.atomNpmPath, buildArgs, buildOptions, (...args) => {
            return this.logCommandResults(callback, ...args);
          });
        });
      }

      packageNamesFromPath(filePath) {
        var packages;
        filePath = path.resolve(filePath);
        if (!fs.isFileSync(filePath)) {
          throw new Error(`File '${filePath}' does not exist`);
        }
        packages = fs.readFileSync(filePath, 'utf8');
        return this.sanitizePackageNames(packages.split(/\s/));
      }

      buildModuleCache(packageName, callback) {
        var packageDirectory, rebuildCacheCommand;
        packageDirectory = path.join(this.atomPackagesDirectory, packageName);
        rebuildCacheCommand = new RebuildModuleCache();
        return rebuildCacheCommand.rebuild(packageDirectory, function() {
          // Ignore cache errors and just finish the install
          return callback();
        });
      }

      warmCompileCache(packageName, callback) {
        var packageDirectory;
        packageDirectory = path.join(this.atomPackagesDirectory, packageName);
        return this.getResourcePath((resourcePath) => {
          var CompileCache, onDirectory, onFile;
          try {
            CompileCache = require(path.join(resourcePath, 'src', 'compile-cache'));
            onDirectory = function(directoryPath) {
              return path.basename(directoryPath) !== 'node_modules';
            };
            onFile = (filePath) => {
              try {
                return CompileCache.addPathToCache(filePath, this.atomDirectory);
              } catch (error1) {}
            };
            fs.traverseTreeSync(packageDirectory, onFile, onDirectory);
          } catch (error1) {}
          return callback(null);
        });
      }

      isBundledPackage(packageName, callback) {
        return this.getResourcePath(function(resourcePath) {
          var atomMetadata, error, ref;
          try {
            atomMetadata = JSON.parse(fs.readFileSync(path.join(resourcePath, 'package.json')));
          } catch (error1) {
            error = error1;
            return callback(false);
          }
          return callback(atomMetadata != null ? (ref = atomMetadata.packageDependencies) != null ? ref.hasOwnProperty(packageName) : void 0 : void 0);
        });
      }

      getLatestCompatibleVersion(pack) {
        var engine, latestVersion, metadata, ref, ref1, ref2, ref3, version;
        if (!this.installedAtomVersion) {
          if (isDeprecatedPackage(pack.name, pack.releases.latest)) {
            return null;
          } else {
            return pack.releases.latest;
          }
        }
        latestVersion = null;
        ref1 = (ref = pack.versions) != null ? ref : {};
        for (version in ref1) {
          metadata = ref1[version];
          if (!semver.valid(version)) {
            continue;
          }
          if (!metadata) {
            continue;
          }
          if (isDeprecatedPackage(pack.name, version)) {
            continue;
          }
          engine = (ref2 = (ref3 = metadata.engines) != null ? ref3.atom : void 0) != null ? ref2 : '*';
          if (!semver.validRange(engine)) {
            continue;
          }
          if (!semver.satisfies(this.installedAtomVersion, engine)) {
            continue;
          }
          if (latestVersion == null) {
            latestVersion = version;
          }
          if (semver.gt(version, latestVersion)) {
            latestVersion = version;
          }
        }
        return latestVersion;
      }

      getHostedGitInfo(name) {
        return hostedGitInfo.fromUrl(name);
      }

      installGitPackage(packageUrl, options, callback) {
        var cloneDir, iteratee, tasks;
        tasks = [];
        cloneDir = temp.mkdirSync("atom-git-package-clone-");
        tasks.push((data, next) => {
          var urls;
          urls = this.getNormalizedGitUrls(packageUrl);
          return this.cloneFirstValidGitUrl(urls, cloneDir, options, function(err) {
            return next(err, data);
          });
        });
        tasks.push((data, next) => {
          return this.installGitPackageDependencies(cloneDir, options, function(err) {
            return next(err, data);
          });
        });
        tasks.push((data, next) => {
          return this.getRepositoryHeadSha(cloneDir, function(err, sha) {
            data.sha = sha;
            return next(err, data);
          });
        });
        tasks.push(function(data, next) {
          var metadataFilePath;
          metadataFilePath = CSON.resolve(path.join(cloneDir, 'package'));
          return CSON.readFile(metadataFilePath, function(err, metadata) {
            data.metadataFilePath = metadataFilePath;
            data.metadata = metadata;
            return next(err, data);
          });
        });
        tasks.push(function(data, next) {
          data.metadata.apmInstallSource = {
            type: "git",
            source: packageUrl,
            sha: data.sha
          };
          return CSON.writeFile(data.metadataFilePath, data.metadata, function(err) {
            return next(err, data);
          });
        });
        tasks.push((data, next) => {
          var name, targetDir;
          ({name} = data.metadata);
          targetDir = path.join(this.atomPackagesDirectory, name);
          if (!options.argv.json) {
            process.stdout.write(`Moving ${name} to ${targetDir} `);
          }
          return fs.cp(cloneDir, targetDir, (err) => {
            var json;
            if (err) {
              return next(err);
            } else {
              if (!options.argv.json) {
                this.logSuccess();
              }
              json = {
                installPath: targetDir,
                metadata: data.metadata
              };
              return next(null, json);
            }
          });
        });
        iteratee = function(currentData, task, next) {
          return task(currentData, next);
        };
        return async.reduce(tasks, {}, iteratee, callback);
      }

      getNormalizedGitUrls(packageUrl) {
        var packageInfo;
        packageInfo = this.getHostedGitInfo(packageUrl);
        if (packageUrl.indexOf('file://') === 0) {
          return [packageUrl];
        } else if (packageInfo.default === 'sshurl') {
          return [packageInfo.toString()];
        } else if (packageInfo.default === 'https') {
          return [packageInfo.https().replace(/^git\+https:/, "https:")];
        } else if (packageInfo.default === 'shortcut') {
          return [packageInfo.https().replace(/^git\+https:/, "https:"), packageInfo.sshurl()];
        }
      }

      cloneFirstValidGitUrl(urls, cloneDir, options, callback) {
        return async.detectSeries(urls, (url, next) => {
          return this.cloneNormalizedUrl(url, cloneDir, options, function(error) {
            return next(!error);
          });
        }, function(result) {
          var invalidUrls, invalidUrlsError;
          if (!result) {
            invalidUrls = `Couldn't clone ${urls.join(' or ')}`;
            invalidUrlsError = new Error(invalidUrls);
            return callback(invalidUrlsError);
          } else {
            return callback();
          }
        });
      }

      cloneNormalizedUrl(url, cloneDir, options, callback) {
        var Develop, develop;
        // Require here to avoid circular dependency
        Develop = require('./develop');
        develop = new Develop();
        return develop.cloneRepository(url, cloneDir, options, function(err) {
          return callback(err);
        });
      }

      installGitPackageDependencies(directory, options, callback) {
        boundMethodCheck(this, Install);
        options.cwd = directory;
        return this.installDependencies(options, callback);
      }

      getRepositoryHeadSha(repoDir, callback) {
        var err, repo, sha;
        try {
          repo = Git.open(repoDir);
          sha = repo.getReferenceTarget("HEAD");
          return callback(null, sha);
        } catch (error1) {
          err = error1;
          return callback(err);
        }
      }

      run(options) {
        var callback, commands, error, installPackage, iteratee, packageNames, packagesFilePath;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        packagesFilePath = options.argv['packages-file'];
        this.createAtomDirectories();
        if (options.argv.check) {
          config.loadNpm((error, npm) => {
            this.npm = npm;
            return this.loadInstalledAtomMetadata(() => {
              return this.checkNativeBuildTools(callback);
            });
          });
          return;
        }
        this.verbose = options.argv.verbose;
        if (this.verbose) {
          request.debug(true);
          process.env.NODE_DEBUG = 'request';
        }
        installPackage = (name, nextInstallStep) => {
          var atIndex, gitPackageInfo, version;
          gitPackageInfo = this.getHostedGitInfo(name);
          if (gitPackageInfo || name.indexOf('file://') === 0) {
            return this.installGitPackage(name, options, nextInstallStep);
          } else if (name === '.') {
            return this.installDependencies(options, nextInstallStep); // is registered package
          } else {
            atIndex = name.indexOf('@');
            if (atIndex > 0) {
              version = name.substring(atIndex + 1);
              name = name.substring(0, atIndex);
            }
            return this.isBundledPackage(name, (isBundledPackage) => {
              if (isBundledPackage) {
                console.error(`The ${name} package is bundled with Atom and should not be explicitly installed.\nYou can run \`apm uninstall ${name}\` to uninstall it and then the version bundled\nwith Atom will be used.`.yellow);
              }
              return this.installRegisteredPackage({name, version}, options, nextInstallStep);
            });
          }
        };
        if (packagesFilePath) {
          try {
            packageNames = this.packageNamesFromPath(packagesFilePath);
          } catch (error1) {
            error = error1;
            return callback(error);
          }
        } else {
          packageNames = this.packageNamesFromArgv(options.argv);
          if (packageNames.length === 0) {
            packageNames.push('.');
          }
        }
        commands = [];
        commands.push((callback) => {
          return config.loadNpm((error, npm) => {
            this.npm = npm;
            return callback(error);
          });
        });
        commands.push((callback) => {
          return this.loadInstalledAtomMetadata(function() {
            return callback();
          });
        });
        packageNames.forEach(function(packageName) {
          return commands.push(function(callback) {
            return installPackage(packageName, callback);
          });
        });
        iteratee = function(item, next) {
          return item(next);
        };
        return async.mapSeries(commands, iteratee, function(err, installedPackagesInfo) {
          if (err) {
            return callback(err);
          }
          installedPackagesInfo = _.compact(installedPackagesInfo);
          installedPackagesInfo = installedPackagesInfo.filter(function(item, idx) {
            return packageNames[idx] !== ".";
          });
          if (options.argv.json) {
            console.log(JSON.stringify(installedPackagesInfo, null, "  "));
          }
          return callback(null);
        });
      }

    };

    Install.commandNames = ['install', 'i'];

    return Install;

  }).call(this);

}).call(this);
