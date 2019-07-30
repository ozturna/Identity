(function() {
  var Command, Git, Install, Packages, Upgrade, _, async, config, fs, git, path, read, request, semver, tree, yargs;

  path = require('path');

  _ = require('underscore-plus');

  async = require('async');

  yargs = require('yargs');

  read = require('read');

  semver = require('semver');

  Git = require('git-utils');

  Command = require('./command');

  config = require('./apm');

  fs = require('./fs');

  Install = require('./install');

  Packages = require('./packages');

  request = require('./request');

  tree = require('./tree');

  git = require('./git');

  module.exports = Upgrade = (function() {
    class Upgrade extends Command {
      constructor() {
        super();
        this.atomDirectory = config.getAtomDirectory();
        this.atomPackagesDirectory = path.join(this.atomDirectory, 'packages');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm upgrade\n       apm upgrade --list\n       apm upgrade [<package_name>...]\n\nUpgrade out of date packages installed to ~/.atom/packages\n\nThis command lists the out of date packages and then prompts to install\navailable updates.");
        options.alias('c', 'confirm').boolean('confirm').default('confirm', true).describe('confirm', 'Confirm before installing updates');
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.alias('l', 'list').boolean('list').describe('list', 'List but don\'t install the outdated packages');
        options.boolean('json').describe('json', 'Output outdated packages as a JSON array');
        options.string('compatible').describe('compatible', 'Only list packages/themes compatible with this Atom version');
        return options.boolean('verbose').default('verbose', false).describe('verbose', 'Show verbose debug information');
      }

      getInstalledPackages(options) {
        var i, len, name, pack, packageNames, packages, ref;
        packages = [];
        ref = fs.list(this.atomPackagesDirectory);
        for (i = 0, len = ref.length; i < len; i++) {
          name = ref[i];
          if (pack = this.getIntalledPackage(name)) {
            packages.push(pack);
          }
        }
        packageNames = this.packageNamesFromArgv(options.argv);
        if (packageNames.length > 0) {
          packages = packages.filter(function({name}) {
            return packageNames.indexOf(name) !== -1;
          });
        }
        return packages;
      }

      getIntalledPackage(name) {
        var metadata, packageDirectory;
        packageDirectory = path.join(this.atomPackagesDirectory, name);
        if (fs.isSymbolicLinkSync(packageDirectory)) {
          return;
        }
        try {
          metadata = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json')));
          if ((metadata != null ? metadata.name : void 0) && (metadata != null ? metadata.version : void 0)) {
            return metadata;
          }
        } catch (error1) {}
      }

      loadInstalledAtomVersion(options, callback) {
        if (options.argv.compatible) {
          return process.nextTick(() => {
            var version;
            version = this.normalizeVersion(options.argv.compatible);
            if (semver.valid(version)) {
              this.installedAtomVersion = version;
            }
            return callback();
          });
        } else {
          return this.loadInstalledAtomMetadata(callback);
        }
      }

      folderIsRepo(pack) {
        var repoGitFolderPath;
        repoGitFolderPath = path.join(this.atomPackagesDirectory, pack.name, '.git');
        return fs.existsSync(repoGitFolderPath);
      }

      getLatestVersion(pack, callback) {
        var requestSettings;
        requestSettings = {
          url: `${config.getAtomPackagesUrl()}/${pack.name}`,
          json: true
        };
        return request.get(requestSettings, (error, response, body = {}) => {
          var atomVersion, engine, latestVersion, message, metadata, ref, ref1, ref2, ref3, ref4, ref5, version;
          if (error != null) {
            return callback(`Request for package information failed: ${error.message}`);
          } else if (response.statusCode === 404) {
            return callback();
          } else if (response.statusCode !== 200) {
            message = (ref = (ref1 = body.message) != null ? ref1 : body.error) != null ? ref : body;
            return callback(`Request for package information failed: ${message}`);
          } else {
            atomVersion = this.installedAtomVersion;
            latestVersion = pack.version;
            ref3 = (ref2 = body.versions) != null ? ref2 : {};
            for (version in ref3) {
              metadata = ref3[version];
              if (!semver.valid(version)) {
                continue;
              }
              if (!metadata) {
                continue;
              }
              engine = (ref4 = (ref5 = metadata.engines) != null ? ref5.atom : void 0) != null ? ref4 : '*';
              if (!semver.validRange(engine)) {
                continue;
              }
              if (!semver.satisfies(atomVersion, engine)) {
                continue;
              }
              if (semver.gt(version, latestVersion)) {
                latestVersion = version;
              }
            }
            if (latestVersion !== pack.version && this.hasRepo(pack)) {
              return callback(null, latestVersion);
            } else {
              return callback();
            }
          }
        });
      }

      getLatestSha(pack, callback) {
        var repoPath;
        repoPath = path.join(this.atomPackagesDirectory, pack.name);
        return config.getSetting('git', (command) => {
          var args;
          if (command == null) {
            command = 'git';
          }
          args = ['fetch', 'origin', 'master'];
          git.addGitToEnv(process.env);
          return this.spawn(command, args, {
            cwd: repoPath
          }, function(code, stderr = '', stdout = '') {
            var repo, sha;
            if (code !== 0) {
              return callback(new Error('Exit code: ' + code + ' - ' + stderr));
            }
            repo = Git.open(repoPath);
            sha = repo.getReferenceTarget(repo.getUpstreamBranch('refs/heads/master'));
            if (sha !== pack.apmInstallSource.sha) {
              return callback(null, sha);
            } else {
              return callback();
            }
          });
        });
      }

      hasRepo(pack) {
        return Packages.getRepository(pack) != null;
      }

      getAvailableUpdates(packages, callback) {
        var getLatestVersionOrSha;
        getLatestVersionOrSha = (pack, done) => {
          var ref;
          if (this.folderIsRepo(pack) && ((ref = pack.apmInstallSource) != null ? ref.type : void 0) === 'git') {
            return this.getLatestSha(pack, function(err, sha) {
              return done(err, {pack, sha});
            });
          } else {
            return this.getLatestVersion(pack, function(err, latestVersion) {
              return done(err, {pack, latestVersion});
            });
          }
        };
        return async.mapLimit(packages, 10, getLatestVersionOrSha, function(error, updates) {
          if (error != null) {
            return callback(error);
          }
          updates = _.filter(updates, function(update) {
            return (update.latestVersion != null) || (update.sha != null);
          });
          updates.sort(function(updateA, updateB) {
            return updateA.pack.name.localeCompare(updateB.pack.name);
          });
          return callback(null, updates);
        });
      }

      promptForConfirmation(callback) {
        return read({
          prompt: 'Would you like to install these updates? (yes)',
          edit: true
        }, function(error, answer) {
          answer = answer ? answer.trim().toLowerCase() : 'yes';
          return callback(error, answer === 'y' || answer === 'yes');
        });
      }

      installUpdates(updates, callback) {
        var i, installCommands, latestVersion, len, pack, verbose;
        installCommands = [];
        verbose = this.verbose;
        for (i = 0, len = updates.length; i < len; i++) {
          ({pack, latestVersion} = updates[i]);
          (function(pack, latestVersion) {
            return installCommands.push(function(callback) {
              var commandArgs, ref;
              if (((ref = pack.apmInstallSource) != null ? ref.type : void 0) === 'git') {
                commandArgs = [pack.apmInstallSource.source];
              } else {
                commandArgs = [`${pack.name}@${latestVersion}`];
              }
              if (verbose) {
                commandArgs.unshift('--verbose');
              }
              return new Install().run({callback, commandArgs});
            });
          })(pack, latestVersion);
        }
        return async.waterfall(installCommands, callback);
      }

      run(options) {
        var callback, command;
        ({callback, command} = options);
        options = this.parseOptions(options.commandArgs);
        options.command = command;
        this.verbose = options.argv.verbose;
        if (this.verbose) {
          request.debug(true);
          process.env.NODE_DEBUG = 'request';
        }
        return this.loadInstalledAtomVersion(options, () => {
          if (this.installedAtomVersion) {
            return this.upgradePackages(options, callback);
          } else {
            return callback('Could not determine current Atom version installed');
          }
        });
      }

      upgradePackages(options, callback) {
        var packages;
        packages = this.getInstalledPackages(options);
        return this.getAvailableUpdates(packages, (error, updates) => {
          var packagesWithLatestVersionOrSha;
          if (error != null) {
            return callback(error);
          }
          if (options.argv.json) {
            packagesWithLatestVersionOrSha = updates.map(function({pack, latestVersion, sha}) {
              if (latestVersion) {
                pack.latestVersion = latestVersion;
              }
              if (sha) {
                pack.latestSha = sha;
              }
              return pack;
            });
            console.log(JSON.stringify(packagesWithLatestVersionOrSha));
          } else {
            console.log("Package Updates Available".cyan + ` (${updates.length})`);
            tree(updates, function({pack, latestVersion, sha}) {
              var apmInstallSource, name, ref, version;
              ({name, apmInstallSource, version} = pack);
              name = name.yellow;
              if (sha != null) {
                version = apmInstallSource.sha.substr(0, 8).red;
                latestVersion = sha.substr(0, 8).green;
              } else {
                version = version.red;
                latestVersion = latestVersion.green;
              }
              latestVersion = (latestVersion != null ? latestVersion.green : void 0) || (apmInstallSource != null ? (ref = apmInstallSource.sha) != null ? ref.green : void 0 : void 0);
              return `${name} ${version} -> ${latestVersion}`;
            });
          }
          if (options.command === 'outdated') {
            return callback();
          }
          if (options.argv.list) {
            return callback();
          }
          if (updates.length === 0) {
            return callback();
          }
          console.log();
          if (options.argv.confirm) {
            return this.promptForConfirmation((error, confirmed) => {
              if (error != null) {
                return callback(error);
              }
              if (confirmed) {
                console.log();
                return this.installUpdates(updates, callback);
              } else {
                return callback();
              }
            });
          } else {
            return this.installUpdates(updates, callback);
          }
        });
      }

    };

    Upgrade.commandNames = ['upgrade', 'outdated', 'update'];

    return Upgrade;

  }).call(this);

}).call(this);
