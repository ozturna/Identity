(function() {
  var Command, Login, Q, _, auth, open, read, yargs,
    boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

  _ = require('underscore-plus');

  yargs = require('yargs');

  Q = require('q');

  read = require('read');

  open = require('open');

  auth = require('./auth');

  Command = require('./command');

  module.exports = Login = (function() {
    class Login extends Command {
      constructor() {
        super(...arguments);
        this.welcomeMessage = this.welcomeMessage.bind(this);
        this.getToken = this.getToken.bind(this);
        this.saveToken = this.saveToken.bind(this);
      }

      static getTokenOrLogin(callback) {
        return auth.getToken(function(error, token) {
          if (error != null) {
            return new Login().run({
              callback,
              commandArgs: []
            });
          } else {
            return callback(null, token);
          }
        });
      }

      parseOptions(argv) {
        var options;
        options = yargs(argv).wrap(100);
        options.usage("Usage: apm login\n\nEnter your Atom.io API token and save it to the keychain. This token will\nbe used to identify you when publishing packages to atom.io.");
        options.alias('h', 'help').describe('help', 'Print this usage message');
        return options.string('token').describe('token', 'atom.io API token');
      }

      run(options) {
        var callback;
        ({callback} = options);
        options = this.parseOptions(options.commandArgs);
        return Q({
          token: options.argv.token
        }).then(this.welcomeMessage).then(this.openURL).then(this.getToken).then(this.saveToken).then(function(token) {
          return callback(null, token);
        }).catch(callback);
      }

      prompt(options) {
        var readPromise;
        readPromise = Q.denodeify(read);
        return readPromise(options);
      }

      welcomeMessage(state) {
        var welcome;
        boundMethodCheck(this, Login);
        if (state.token) {
          return Q(state);
        }
        welcome = `Welcome to Atom!\n\nBefore you can publish packages, you'll need an API token.\n\nVisit your account page on Atom.io ${'https://atom.io/account'.underline},\ncopy the token and paste it below when prompted.\n`;
        console.log(welcome);
        return this.prompt({
          prompt: "Press [Enter] to open your account page on Atom.io."
        });
      }

      openURL(state) {
        if (state.token) {
          return Q(state);
        }
        return open('https://atom.io/account');
      }

      getToken(state) {
        boundMethodCheck(this, Login);
        if (state.token) {
          return Q(state);
        }
        return this.prompt({
          prompt: 'Token>',
          edit: true
        }).spread(function(token) {
          state.token = token;
          return Q(state);
        });
      }

      saveToken({token}) {
        boundMethodCheck(this, Login);
        if (!token) {
          throw new Error("Token is required");
        }
        process.stdout.write('Saving token to Keychain ');
        auth.saveToken(token);
        this.logSuccess();
        return Q(token);
      }

    };

    Login.commandNames = ['login'];

    return Login;

  }).call(this);

}).call(this);
