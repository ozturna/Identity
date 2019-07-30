(function() {
  var url;

  url = require('url');

  // Package helpers
  module.exports = {
    // Parse the repository in `name/owner` format from the package metadata.

    // pack - The package metadata object.

    // Returns a name/owner string or null if not parseable.
    getRepository: function(pack = {}) {
      var name, owner, ref, ref1, repoPath, repository;
      if (repository = (ref = (ref1 = pack.repository) != null ? ref1.url : void 0) != null ? ref : pack.repository) {
        repoPath = url.parse(repository.replace(/\.git$/, '')).pathname;
        [name, owner] = repoPath.split('/').slice(-2);
        if (name && owner) {
          return `${name}/${owner}`;
        }
      }
      return null;
    },
    // Determine remote from package metadata.

    // pack - The package metadata object.
    // Returns a the remote or 'origin' if not parseable.
    getRemote: function(pack = {}) {
      var ref;
      return ((ref = pack.repository) != null ? ref.url : void 0) || pack.repository || 'origin';
    }
  };

}).call(this);
