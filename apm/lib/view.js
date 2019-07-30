(function() {
  var Command, View, _, config, request, semver, tree, yargs;

  _ = require('underscore-plus');

  yargs = require('yargs');

  semver = require('semver');

  Command = require('./command');

  config = require('./apm');

  request = require('./request');

  tree = require('./tree');

  module.exports = View = (function() {
    class View extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm view <package_name>\n\nView information about a package/theme in the atom.io registry.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.boolean('json').describe('json', 'Output featured packages as JSON array');
        return options.string('compatible').describe('compatible', 'Show the latest version compatible with this Atom version');
      }

      loadInstalledAtomVersion(options, callback) {
        return process.nextTick(() => {
          var installedAtomVersion, version;
          if (options.argv.compatible) {
            version = this.normalizeVersion(options.argv.compatible);
            if (semver.valid(version)) {
              installedAtomVersion = version;
            }
          }
          return callback(installedAtomVersion);
        });
      }

      getLatestCompatibleVersion(pack, options, callback) {
        return this.loadInstalledAtomVersion(options, function(installedAtomVersion) {
          var engine, latestVersion, metadata, ref, ref1, ref2, ref3, version;
          if (!installedAtomVersion) {
            return callback(pack.releases.latest);
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
            engine = (ref2 = (ref3 = metadata.engines) != null ? ref3.atom : void 0) != null ? ref2 : '*';
            if (!semver.validRange(engine)) {
              continue;
            }
            if (!semver.satisfies(installedAtomVersion, engine)) {
              continue;
            }
            if (latestVersion == null) {
              latestVersion = version;
            }
            if (semver.gt(version, latestVersion)) {
              latestVersion = version;
            }
          }
          return callback(latestVersion);
        });
      }

      getRepository(pack) {
        var ref, ref1, repository;
        if (repository = (ref = (ref1 = pack.repository) != null ? ref1.url : void 0) != null ? ref : pack.repository) {
          return repository.replace(/\.git$/, '');
        }
      }

      getPackage(packageName, options, callback) {
        var requestSettings;
        requestSettings = {
          url: `${config.getAtomPackagesUrl()}/${packageName}`,
          json: true
        };
        return request.get(requestSettings, (error, response, body = {}) => {
          var message, ref, ref1;
          if (error != null) {
            return callback(error);
          } else if (response.statusCode === 200) {
            return this.getLatestCompatibleVersion(body, options, function(version) {
              var downloads, metadata, name, pack, readme, ref, ref1, stargazers_count;
              ({name, readme, downloads, stargazers_count} = body);
              metadata = (ref = (ref1 = body.versions) != null ? ref1[version] : void 0) != null ? ref : {name};
              pack = _.extend({}, metadata, {readme, downloads, stargazers_count});
              return callback(null, pack);
            });
          } else {
            message = (ref = (ref1 = body.message) != null ? ref1 : body.error) != null ? ref : body;
            return callback(`Requesting package failed: ${message}`);
          }
        });
      }

      run(options) {
        var callback, packageName;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        [packageName] = options.argv._;
        if (!packageName) {
          callback("Missing required package name");
          return;
        }
        return this.getPackage(packageName, options, (error, pack) => {
          var items, repository;
          if (error != null) {
            callback(error);
            return;
          }
          if (options.argv.json) {
            console.log(JSON.stringify(pack, null, 2));
          } else {
            console.log(`${pack.name.cyan}`);
            items = [];
            if (pack.version) {
              items.push(pack.version.yellow);
            }
            if (repository = this.getRepository(pack)) {
              items.push(repository.underline);
            }
            if (pack.description) {
              items.push(pack.description.replace(/\s+/g, ' '));
            }
            if (pack.downloads >= 0) {
              items.push(_.pluralize(pack.downloads, 'download'));
            }
            if (pack.stargazers_count >= 0) {
              items.push(_.pluralize(pack.stargazers_count, 'star'));
            }
            tree(items);
            console.log();
            console.log(`Run \`apm install ${pack.name}\` to install this package.`);
            console.log();
          }
          return callback();
        });
      }

    };

    View.commandNames = ['view', 'show'];

    return View;

  }).call(this);

}).call(this);
