(function() {
  var Command, Config, _, apm, path, yargs;

  path = require('path');

  _ = require('underscore-plus');

  yargs = require('yargs');

  apm = require('./apm');

  Command = require('./command');

  module.exports = Config = (function() {
    class Config extends Command {
      constructor() {
        var atomDirectory;
        super();
        atomDirectory = apm.getAtomDirectory();
        this.atomNodeDirectory = path.join(atomDirectory, '.node-gyp');
        this.atomNpmPath = require.resolve('npm/bin/npm-cli');
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("\nUsage: apm config set <key> <value>\n       apm config get <key>\n       apm config delete <key>\n       apm config list\n       apm config edit\n");
        return options.alias('h', 'help').describe('help', 'Print this usage message');
      }

      run(options) {
        var callback, configArgs, configOptions, env;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        configArgs = ['--globalconfig', apm.getGlobalConfigPath(), '--userconfig', apm.getUserConfigPath(), 'config'];
        configArgs = configArgs.concat(options.argv._);
        env = _.extend({}, process.env, {
          HOME: this.atomNodeDirectory,
          RUSTUP_HOME: apm.getRustupHomeDirPath()
        });
        configOptions = {env};
        return this.fork(this.atomNpmPath, configArgs, configOptions, function(code, stderr = '', stdout = '') {
          if (code === 0) {
            if (stdout) {
              process.stdout.write(stdout);
            }
            return callback();
          } else {
            if (stderr) {
              process.stdout.write(stderr);
            }
            return callback(new Error(`npm config failed: ${code}`));
          }
        });
      }

    };

    Config.commandNames = ['config'];

    return Config;

  }).call(this);

}).call(this);
