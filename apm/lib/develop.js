(function() {
  var Command, Develop, Install, Link, _, async, config, fs, git, path, request, yargs;

  fs = require('fs');

  path = require('path');

  _ = require('underscore-plus');

  async = require('async');

  yargs = require('yargs');

  config = require('./apm');

  Command = require('./command');

  Install = require('./install');

  git = require('./git');

  Link = require('./link');

  request = require('./request');

  module.exports = Develop = (function() {
    class Develop extends Command {
      constructor() {
        super();
        this.atomDirectory = config.getAtomDirectory();
        this.atomDevPackagesDirectory = path.join(this.atomDirectory, 'dev', 'packages');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("Usage: apm develop <package_name> [<directory>]\n\nClone the given package's Git repository to the directory specified,\ninstall its dependencies, and link it for development to\n~/.atom/dev/packages/<package_name>.\n\nIf no directory is specified then the repository is cloned to\n~/github/<package_name>. The default folder to clone packages into can\nbe overridden using the ATOM_REPOS_HOME environment variable.\n\nOnce this command completes you can open a dev window from atom using\ncmd-shift-o to run the package out of the newly cloned repository.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      getRepositoryUrl(packageName, callback) {
        var requestSettings;
        requestSettings = {
          url: `${config.getAtomPackagesUrl()}/${packageName}`,
          json: true
        };
        return request.get(requestSettings, function(error, response, body = {}) {
          var message, repositoryUrl;
          if (error != null) {
            return callback(`Request for package information failed: ${error.message}`);
          } else if (response.statusCode === 200) {
            if (repositoryUrl = body.repository.url) {
              return callback(null, repositoryUrl);
            } else {
              return callback(`No repository URL found for package: ${packageName}`);
            }
          } else {
            message = request.getErrorMessage(response, body);
            return callback(`Request for package information failed: ${message}`);
          }
        });
      }

      cloneRepository(repoUrl, packageDirectory, options, callback = function() {}) {
        return config.getSetting('git', (command) => {
          var args;
          if (command == null) {
            command = 'git';
          }
          args = ['clone', '--recursive', repoUrl, packageDirectory];
          if (!options.argv.json) {
            process.stdout.write(`Cloning ${repoUrl} `);
          }
          git.addGitToEnv(process.env);
          return this.spawn(command, args, (...args) => {
            if (options.argv.json) {
              return this.logCommandResultsIfFail(callback, ...args);
            } else {
              return this.logCommandResults(callback, ...args);
            }
          });
        });
      }

      installDependencies(packageDirectory, options, callback = function() {}) {
        var installOptions;
        process.chdir(packageDirectory);
        installOptions = _.clone(options);
        installOptions.callback = callback;
        return new Install().run(installOptions);
      }

      linkPackage(packageDirectory, options, callback) {
        var linkOptions;
        linkOptions = _.clone(options);
        if (callback) {
          linkOptions.callback = callback;
        }
        linkOptions.commandArgs = [packageDirectory, '--dev'];
        return new Link().run(linkOptions);
      }

      run(options) {
        var packageDirectory, packageName, ref;
        packageName = options.commandArgs.shift();
        if (!((packageName != null ? packageName.length : void 0) > 0)) {
          return options.callback("Missing required package name");
        }
        packageDirectory = (ref = options.commandArgs.shift()) != null ? ref : path.join(config.getReposDirectory(), packageName);
        packageDirectory = path.resolve(packageDirectory);
        if (fs.existsSync(packageDirectory)) {
          return this.linkPackage(packageDirectory, options);
        } else {
          return this.getRepositoryUrl(packageName, (error, repoUrl) => {
            var tasks;
            if (error != null) {
              return options.callback(error);
            } else {
              tasks = [];
              tasks.push((callback) => {
                return this.cloneRepository(repoUrl, packageDirectory, options, callback);
              });
              tasks.push((callback) => {
                return this.installDependencies(packageDirectory, options, callback);
              });
              tasks.push((callback) => {
                return this.linkPackage(packageDirectory, options, callback);
              });
              return async.waterfall(tasks, options.callback);
            }
          });
        }
      }

    };

    Develop.commandNames = ['dev', 'develop'];

    return Develop;

  }).call(this);

}).call(this);
