const MongoStat = require('./lib/stat');

module.exports = function (schema = {}) {
  return new MongoStat(schema);
};
