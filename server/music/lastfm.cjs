const shared = require("../../dist/music/lastfm-client.js");
module.exports = {
  editorial: shared.editorial,
  createLastfmClient: (options = {}) => shared.createLastfmClient({ env: process.env, ...options }),
};
