Simple, async, ES6 based module to get statistics quickly from mongodb by dates to [chartjs](https://chartjs.org/)

[Demo](https://safiullin.io/mongodb-stats2/)
[changelog](changelog.md)

Scope
============
* aggregate by today, week, month and etc
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

`avg=FIELD_NAME` - avg by fieldname

`max=FIELD_NAME` - max value by fieldname

`search[k]=val` - advanced filter options

If you have a lot of data and they are constantly being added, then by default this response will be built.

`[num,num,num,num,num....]`

If there is old data then you need to add a limit

`limit=1000` - limit if you get old stats

`ldate=date.toISOString` - last date, offset by date

, then such a response will return

`[{d,val},{d,val},{d,val}]`

where `d` - last date, `val` - stat value

TODO
========
* sum aggregation
* parse from, to params
* pass models by collection names
