(function() {
  var Command, Test, fs, path, temp, yargs;

  path = require('path');

  yargs = require('yargs');

  temp = require('temp');

  Command = require('./command');

  fs = require('./fs');

  module.exports = Test = (function() {
    class Test extends Command {
      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("Usage:\n  apm test\n\nRuns the package's tests contained within the spec directory (relative\nto the current working directory).");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        return options.alias('p', 'path').string('path').describe('path', 'Path to atom command');
      }

      run(options) {
        var atomCommand, callback, env, logFile, logFilePath, packagePath, testArgs;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        ({env} = process);
        if (options.argv.path) {
          atomCommand = options.argv.path;
        }
        if (!fs.existsSync(atomCommand)) {
          atomCommand = 'atom';
          if (process.platform === 'win32') {
            atomCommand += '.cmd';
          }
        }
        packagePath = process.cwd();
        testArgs = ['--dev', '--test', path.join(packagePath, 'spec')];
        if (process.platform === 'win32') {
          logFile = temp.openSync({
            suffix: '.log',
            prefix: `${path.basename(packagePath)}-`
          });
          fs.closeSync(logFile.fd);
          logFilePath = logFile.path;
          testArgs.push(`--log-file=${logFilePath}`);
          return this.spawn(atomCommand, testArgs, function(code) {
            var loggedOutput;
            try {
              loggedOutput = fs.readFileSync(logFilePath, 'utf8');
              if (loggedOutput) {
                process.stdout.write(`${loggedOutput}\n`);
              }
            } catch (error) {}
            if (code === 0) {
              process.stdout.write('Tests passed\n'.green);
              return callback();
            } else if (code != null ? code.message : void 0) {
              return callback(`Error spawning Atom: ${code.message}`);
            } else {
              return callback('Tests failed');
            }
          });
        } else {
          return this.spawn(atomCommand, testArgs, {
            env,
            streaming: true
          }, function(code) {
            if (code === 0) {
              process.stdout.write('Tests passed\n'.green);
              return callback();
            } else if (code != null ? code.message : void 0) {
              return callback(`Error spawning ${atomCommand}: ${code.message}`);
            } else {
              return callback('Tests failed');
            }
          });
        }
      }

    };

    Test.commandNames = ['test'];

    return Test;

  }).call(this);

}).call(this);
