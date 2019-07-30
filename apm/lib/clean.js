(function() {
  var CSON, Clean, Command, _, async, config, fs, path, yargs;

  path = require('path');

  async = require('async');

  CSON = require('season');

  yargs = require('yargs');

  _ = require('underscore-plus');

  Command = require('./command');

  config = require('./apm');

  fs = require('./fs');

  module.exports = Clean = (function() {
    class Clean extends Command {
      constructor() {
        super();
        this.atomNpmPath = require.resolve('npm/bin/npm-cli');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("Usage: apm clean\n\nDeletes all packages in the node_modules folder that are not referenced\nas a dependency in the package.json file.");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      run(options) {
        process.stdout.write("Removing extraneous modules ");
        return this.fork(this.atomNpmPath, ['prune'], (...args) => {
          return this.logCommandResults(options.callback, ...args);
        });
      }

    };

    Clean.commandNames = ['clean', 'prune'];

    return Clean;

  }).call(this);

}).call(this);
