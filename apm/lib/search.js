(function() {
  var Command, Search, _, config, isDeprecatedPackage, request, tree, yargs;

  _ = require('underscore-plus');

  yargs = require('yargs');

  Command = require('./command');

  config = require('./apm');

  request = require('./request');

  tree = require('./tree');

  ({isDeprecatedPackage} = require('./deprecated-packages'));

  module.exports = Search = (function() {
    class Search extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm search <package_name>\n\nSearch for Atom packages/themes on the atom.io registry.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        options.boolean('json').describe('json', 'Output matching packages as JSON array');
        options.boolean('packages').describe('packages', 'Search only non-theme packages').alias('p', 'packages');
        return options.boolean('themes').describe('themes', 'Search only themes').alias('t', 'themes');
      }

      searchPackages(query, opts, callback) {
        var qs, requestSettings;
        qs = {
          q: query
        };
        if (opts.packages) {
          qs.filter = 'package';
        } else if (opts.themes) {
          qs.filter = 'theme';
        }
        requestSettings = {
          url: `${config.getAtomPackagesUrl()}/search`,
          qs: qs,
          json: true
        };
        return request.get(requestSettings, function(error, response, body = {}) {
          var message, packages;
          if (error != null) {
            return callback(error);
          } else if (response.statusCode === 200) {
            packages = body.filter(function(pack) {
              var ref;
              return ((ref = pack.releases) != null ? ref.latest : void 0) != null;
            });
            packages = packages.map(function({readme, metadata, downloads, stargazers_count}) {
              return _.extend({}, metadata, {readme, downloads, stargazers_count});
            });
            packages = packages.filter(function({name, version}) {
              return !isDeprecatedPackage(name, version);
            });
            return callback(null, packages);
          } else {
            message = request.getErrorMessage(response, body);
            return callback(`Searching packages failed: ${message}`);
          }
        });
      }

      run(options) {
        var callback, query, searchOptions;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        [query] = options.argv._;
        if (!query) {
          callback("Missing required search query");
          return;
        }
        searchOptions = {
          packages: options.argv.packages,
          themes: options.argv.themes
        };
        return this.searchPackages(query, searchOptions, function(error, packages) {
          var heading;
          if (error != null) {
            callback(error);
            return;
          }
          if (options.argv.json) {
            console.log(JSON.stringify(packages));
          } else {
            heading = `Search Results For '${query}'`.cyan;
            console.log(`${heading} (${packages.length})`);
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
        });
      }

    };

    Search.commandNames = ['search'];

    return Search;

  }).call(this);

}).call(this);
