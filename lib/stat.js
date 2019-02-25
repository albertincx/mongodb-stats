'use strict';

function toLocalTime(val, h = null) {
  const d = val ? new Date(val) : new Date();
  if (h) {
    d.setHours(h);
  }
  d.setHours(d.getHours() + (-3 * -1));
  if (h) {
    return d.getHours();
  }
  return new Date(d.getTime());
}

function getVal(item) {
  return item.avg ? item.avg : item.count;
}

function prepare(items, type) {
  let isDay = !type || type === 't';
  let dayField = 'd';
  let d;
  const counts = {};

  if (isDay) {
    d = new Array(24).fill(0);
    dayField = 'hour';
  }

  items.map(i => {
    const val = getVal(i);
    if (val) {
      let h = parseInt(i._id[dayField]);
      if (isDay) {
        h = toLocalTime(null, h);
      }
      counts[h] = val;
    }
  });

  if (isDay) {
    d.map((i, ii) => {
      d[ii] = counts[ii] ? counts[ii] : 0;
    });
    return d;
  }

  return counts;
}

const MongoStat = function (scheme = {}) {
  this.scheme = scheme;
  this.hasCustom = (scheme.avg && Object.keys(scheme.avg).length) ||
    (scheme.sum && Object.keys(scheme.sum).length);
};


MongoStat.prototype.today = function (modelName) {
  const obj = {};
  const createdAtField = `$${this.dateFieldName}`;
  obj.$project = {
    'y': { '$year': createdAtField },
    'm': { '$month': createdAtField },
    'd': { '$dayOfMonth': createdAtField },
    'h': { '$hour': createdAtField },
  };
  obj.$group = {
    '_id': {
      'year': '$y',
      'month': '$m',
      'day': '$d',
      'hour': '$h'
    },
  };
  obj.$group.count = {
    $sum: 1,
  };

  return obj;
};
MongoStat.prototype.weekOrMonth = function () {
  const obj = {};
  var createdAtField = `$${this.dateFieldName}`;
  obj.$project = {
    'd': { '$dayOfMonth': createdAtField },
    yearMonthDay: {
      $dateToString: {
        format: '%Y-%m-%d',
        date: createdAtField
      }
    },
    time: {
      $dateToString: {
        format: '%H:%M:%S:%L',
        date: createdAtField
      }
    },
  };
  obj.$group = {
    _id: {
      d: '$d',
    },
    count: {
      $sum: 1,
    },
  };
  obj.$sort = { _id: 1 };
  return obj;
};

MongoStat.prototype.parseParams = function (query) {
  let filter = {};

  this.dateFieldName = this.scheme.dateFields.createdAt;
  if (query.updatedAt || query.upd) {
    this.dateFieldName = this.scheme.dateFields.updatedAt;
  }

  let firstDay;
  let lastDay;

  let date = new Date();

  if (query.type === 't' || query.day) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    firstDay = start;
    lastDay = end;
  }


  if (query.month || query.type === 'm') {
    firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  if (query.week || query.type === 'w') {
    let weekStart = new Date();
    weekStart.setDate(date.getDate() - 7);
    firstDay = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    lastDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }


  if (firstDay && lastDay) {
    filter[this.dateFieldName] = {
      $gte: firstDay,
      $lt: lastDay
    };
  }
  return filter;
};

MongoStat.prototype.getArrgegation = function (type, modelName) {
  const isDay = !type || type === 't';
  const aggr = [];
  let obj = {};
  if (isDay) {
    obj = this.today(modelName);
  } else {
    obj = this.weekOrMonth(modelName);
  }
  Object.keys(obj)
    .map(key => aggr.push({ [key]: obj[key] }));
  return aggr;
};

MongoStat.prototype.stat = async function (req, models) {
  var tasks = [];
  const { query } = req;
  const { type } = query;
  try {
    const filter = this.parseParams(query);
    let aggr = [];
    if (!this.hasCustom) {
      aggr = this.getArrgegation(type);
      aggr.unshift({ $match: filter });
    }

    for (let i = 0; i < models.length; i += 1) {
      const collName = models[i].collection.collectionName;
      if (this.hasCustom) {
        aggr = [];
        aggr = this.getArrgegation(type, collName);
        aggr.unshift({ $match: filter });
      }

      tasks.push(models[i].collection.aggregate(aggr)
        .toArray());
    }
  } catch (e) {
    console.log(e);
  }
  return Promise.all(tasks)
    .then(data => data.map(items => prepare(items, type)));
};


module.exports = MongoStat;
