(function() {
  var Command, Featured, _, config, request, tree, yargs;

  _ = require('underscore-plus');

  yargs = require('yargs');

  Command = require('./command');

  config = require('./apm');

  request = require('./request');

  tree = require('./tree');

  module.exports = Featured = (function() {
    class Featured extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm featured\n       apm featured --themes\n       apm featured --compatible 0.49.0\n\nList the Atom packages and themes that are currently featured in the\natom.io registry.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.alias('t', 'themes').boolean('themes').describe('themes', 'Only list themes');
        options.alias('c', 'compatible').string('compatible').describe('compatible', 'Only list packages/themes compatible with this Atom version');
        return options.boolean('json').describe('json', 'Output featured packages as JSON array');
      }

      getFeaturedPackagesByType(atomVersion, packageType, callback) {
        var requestSettings;
        if (_.isFunction(atomVersion)) {
          [callback, atomVersion] = [atomVersion, null];
        }
        requestSettings = {
          url: `${config.getAtomApiUrl()}/${packageType}/featured`,
          json: true
        };
        if (atomVersion) {
          requestSettings.qs = {
            engine: atomVersion
          };
        }
        return request.get(requestSettings, function(error, response, body = []) {
          var message, packages;
          if (error != null) {
            return callback(error);
          } else if (response.statusCode === 200) {
            packages = body.filter(function(pack) {
              var ref;
              return (pack != null ? (ref = pack.releases) != null ? ref.latest : void 0 : void 0) != null;
            });
            packages = packages.map(function({readme, metadata, downloads, stargazers_count}) {
              return _.extend({}, metadata, {readme, downloads, stargazers_count});
            });
            packages = _.sortBy(packages, 'name');
            return callback(null, packages);
          } else {
            message = request.getErrorMessage(response, body);
            return callback(`Requesting packages failed: ${message}`);
          }
        });
      }

      getAllFeaturedPackages(atomVersion, callback) {
        return this.getFeaturedPackagesByType(atomVersion, 'packages', (error, packages) => {
          if (error != null) {
            return callback(error);
          }
          return this.getFeaturedPackagesByType(atomVersion, 'themes', function(error, themes) {
            if (error != null) {
              return callback(error);
            }
            return callback(null, packages.concat(themes));
          });
        });
      }

      run(options) {
        var callback, listCallback;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        listCallback = function(error, packages) {
          if (error != null) {
            return callback(error);
          }
          if (options.argv.json) {
            console.log(JSON.stringify(packages));
          } else {
            if (options.argv.themes) {
              console.log(`${'Featured Atom Themes'.cyan} (${packages.length})`);
            } else {
              console.log(`${'Featured Atom Packages'.cyan} (${packages.length})`);
            }
            tree(packages, function({name, version, description, downloads, stargazers_count}) {
              var label;
              label = name.yellow;
              if (description) {
                label += ` ${description.replace(/\s+/g, ' ')}`;
              }
              if (downloads >= 0 && stargazers_count >= 0) {
                label += ` (${_.pluralize(downloads, 'download')}, ${_.pluralize(stargazers_count, 'star')})`.grey;
              }
              return label;
            });
            console.log();
            console.log(`Use \`apm install\` to install them or visit ${'http://atom.io/packages'.underline} to read more about them.`);
            console.log();
          }
          return callback();
        };
        if (options.argv.themes) {
          return this.getFeaturedPackagesByType(options.argv.compatible, 'themes', listCallback);
        } else {
          return this.getAllFeaturedPackages(options.argv.compatible, listCallback);
        }
      }

    };

    Featured.commandNames = ['featured'];

    return Featured;

  }).call(this);

}).call(this);
