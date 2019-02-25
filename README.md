Simple, async, ES6 based module to get statistics quickly from mongodb by dates to [chartjs](https://chartjs.org/)

Scope
============
* aggregate by today, week, month
* stats by created or updated field

Requirements
============

* some project/API based on express with using mongodb, mongoose
* collections with rows which contains `created`, `updated` fields
* client with chartjs

Install
=======

    npm install mongodb-stats

Examples
========

* Define your stats schema
```javascript
const schema = {
  dateFields: {
    createdAt: 'createdAt', // field in your collection
    updatedAt: 'updatedAt',
  },
};
```
* Create some route `stats`
* Define stats object:

```javascript
const MongoStats = require('mongodb-stats');
const AnySchema = require('../../models/any.schema');

const mongoStat = MongoStats(schema);

```
* Example route:
```javascript
  exports.stats = async (req, res, next) => {
    try {
      const View = MongooseModel.collection.conn.model('View', AnySchema);
      const Click = MongooseModel.collection.conn.model('Click', AnySchema);
      const data = await mongoStat.stat(req, [View, Click]);
      res.json(data);
    } catch (error) {
      console.log(error)
      return next(error);
    }
  };
```
That`s all Folks
========
Let`s collect the data

On Client
========
Get /stats request to get data

Example:

`GET /stats?type=t`

`type=w` - by week

`type=m` - by month

TODO
========
* avg, sum aggregation
* parse from, to params
* pass models by collection names
* demo
