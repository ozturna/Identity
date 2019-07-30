(function() {
  var Docs, View, config, open, yargs;

  yargs = require('yargs');

  open = require('open');

  View = require('./view');

  config = require('./apm');

  module.exports = Docs = (function() {
    class Docs extends View {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm docs [options] <package_name>\n\nOpen a package's homepage in the default browser.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        return options.boolean('p').alias('p', 'print').describe('print', 'Print the URL instead of opening it');
      }

      openRepositoryUrl(repositoryUrl) {
        return open(repositoryUrl);
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
          var repository;
          if (error != null) {
            return callback(error);
          }
          if (repository = this.getRepository(pack)) {
            if (options.argv.print) {
              console.log(repository);
            } else {
              this.openRepositoryUrl(repository);
            }
            return callback();
          } else {
            return callback(`Package "${packageName}" does not contain a repository URL`);
          }
        });
      }

    };

    Docs.commandNames = ['docs', 'home', 'open'];

    return Docs;

  }).call(this);

}).call(this);
