const MongoStat = require('./lib/stat');
const defScheme = require('./stats.schema');

module.exports = function (schema = defScheme) {
  return new MongoStat(schema);
};
