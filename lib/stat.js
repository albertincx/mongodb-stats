'use strict';

function toLocalTime(val, h = null) {
  if (/\s/.test(val)) {
    val = val.replace(/\s/, '+');
  }
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

function getVal(item, aggr) {
  return aggr ? item[aggr] : item.count;
}

const MongoStat = function(scheme) {
  this.scheme = scheme;
  this.hasCustom = (scheme.avg && Object.keys(scheme.avg).length) ||
      (scheme.sum && Object.keys(scheme.sum).length);
};

MongoStat.prototype.prepare = function(items) {
  const { type = 't', avg, max, limit } = this.query;
  let isDay = type === 't';
  let dayField = 'd';
  let d;
  const counts = {};

  if (isDay) {
    d = new Array(24).fill(0);
    dayField = 'hour';
  }

  items.map(i => {
    let val = getVal(i, avg || max);
    if (val) {
      let h = parseInt(i._id[dayField]);
      if (isDay) {
        h = toLocalTime(null, h);
      }
      if (limit) {
        val = {
          d: i._id.date,
          val,
        };
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
};

MongoStat.prototype.today = function() {
  const obj = {};
  const createdAtField = `$${this.dateFieldName}`;
  obj.$project = {
    y: { '$year': createdAtField },
    m: { '$month': createdAtField },
    d: { '$dayOfMonth': createdAtField },
    h: { '$hour': createdAtField },
  };
  obj.$group = {
    _id: {
      year: '$y',
      month: '$m',
      d: '$d',
      hour: '$h',
    },
  };

  return obj;
};
MongoStat.prototype.weekOrMonth = function() {
  const obj = {};
  var createdAtField = `$${this.dateFieldName}`;
  obj.$project = {
    d: { '$dayOfMonth': createdAtField },
    yearMonthDay: {
      $dateToString: {
        format: '%Y-%m-%d',
        date: createdAtField,
      },
    },
    time: {
      $dateToString: {
        format: '%H:%M:%S:%L',
        date: createdAtField,
      },
    },/**/
  };
  obj.$group = {
    _id: {
      d: '$d',
    },
  };
  obj.$sort = { _id: 1 };

  return obj;
};

MongoStat.prototype.parseQuery = function(params) {
  const options = params;
  const searchOptions = {};
  const ranges = [];
  Object.keys(options).map((key) => {
    let val = options[key];
    if (typeof val === 'string') {
      val = decodeURIComponent(options[key]);
      const isRangeField = /(To|From)$/.test(key);
      if (isRangeField) {
        ranges.push(key.replace(/(To|From)$/, ''));
        return false;
      }
      if (/\*/.test(val)) {
        val = new RegExp(val.replace(/\*/g, ''));
      }
      if (val === '_hs') {
        val = { $ne: null };
      }
    }
    if (Array.isArray(val)) {
      val = { $in: val };
    }
    searchOptions[key] = val;
  });

  if (ranges.length) {
    ranges.map(key => {
      let val = '';
      let keyName = key;
      if (!searchOptions[keyName]) {
        searchOptions[keyName] = {};
      }
      if (options[`${key}From`]) {
        let dir = '$gte';
        val = options[`${key}From`];
        val = toLocalTime(val);
        if (val) searchOptions[keyName][dir] = val;
      }
      if (options[`${key}To`]) {
        val = options[`${key}To`];
        let dir = '$lte';
        val = toLocalTime(val);
        if (val) {
          searchOptions[keyName][dir] = val;
        }
      }
    });
  }
  return searchOptions;
};
MongoStat.prototype.parseParams = function(query) {
  let filter = false;
  this.query = query;
  const { type = 't', limit, ldate } = this.query;
  let { search } = this.query;
  this.dateFieldName = this.scheme.dateFields.createdAt;
  if (query.updatedAt || query.upd) {
    this.dateFieldName = this.scheme.dateFields.updatedAt;
  }
  let dates = false;
  if (search) {
    filter = {};
    search = this.parseQuery(search);
    Object.keys(search).map(i => filter[i] = search[i]);
    if (filter.createdAt) {
      return filter;
    }
  }

  if (limit) {
    return filter;
  }

  let firstDay;
  let lastDay;
  const date = ldate ? new Date(ldate) : new Date();
  let defaultType = 't';

  if (type === 'w' || query.week) {
    defaultType = 'w';
  }
  if (type === 'm' || query.month) {
    defaultType = 'm';
  }

  if (defaultType === 't') {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    firstDay = start;
    lastDay = new Date(date);
  }

  if (defaultType === 'm') {
    firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  if (defaultType === 'w') {
    let weekStart = new Date(date);
    weekStart.setDate(date.getDate() - 6);
    firstDay = new Date(weekStart.getFullYear(), weekStart.getMonth(),
        weekStart.getDate());
    lastDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  }

  lastDay.setHours(23, 59, 59, 999);

  if (firstDay && lastDay) {
    if (!filter) {
      filter = {};
    }
    filter[this.dateFieldName] = {
      $gte: firstDay,
      $lt: lastDay,
    };
  }
  return filter;
};

MongoStat.prototype.getArrgegation = function(query) {
  const filter = this.parseParams(query);
  const { type = 't', avg, max, limit } = query;
  const isDay = type === 't';
  const aggr = [];
  if (filter) {
    aggr.push({ $match: filter });
  }
  if (limit) {
    if (!isNaN(parseInt(limit))) {
      aggr.push({ $limit: parseInt(limit) });
    }
  }
  let obj = {};
  if (isDay) {
    obj = this.today();
  } else {
    obj = this.weekOrMonth();
  }

  if (avg || max) {
    const aggr2 = avg || max;
    let aggr2Field = '$avg';
    if (max) {
      aggr2Field = '$max';
    }
    const aggrKey = `$${aggr2}`;
    const aggrItem = { [aggr2Field]: aggrKey };
    obj.$group[aggr2] = aggrItem;
    obj.$project[aggr2] = aggrKey;
    if (max) {
      obj.$project['d2'] = aggrItem;
      obj.$group._id['d2'] = '$d2';
    }
    // d2: { $max: createdAtField },
    if (limit) {
      obj.$project['date'] = `$${this.dateFieldName}`;
      obj.$group._id['date'] = '$date';
    }
  } else {
    obj.$group.count = {
      $sum: 1,
    };
  }
  Object.keys(obj).map(key => aggr.push({ [key]: obj[key] }));
  return aggr;
};

MongoStat.prototype.stat = async function(req, models) {
  var tasks = [];
  let { query: Q } = req;
  let { searchModel, ...query } = Q;
  try {
    let aggr = [];
    if (!this.hasCustom) {
      aggr = this.getArrgegation(query);
    }

    for (let i = 0; i < models.length; i += 1) {
      if (this.hasCustom) {
        aggr = [];
        aggr = this.getArrgegation(query);
      }
      tasks.push(models[i].aggregate(aggr));
    }
    if (searchModel) {
      Object.keys(searchModel).map(sk => {
        let v = searchModel[sk];
        if (Array.isArray(v) && v.length) {
          v.map(vv => {
            aggr = [];
            query.search.days = vv;
            aggr = this.getArrgegation(query);
            tasks.push(models[0].aggregate(aggr));
          });
        }
      });
    }
  } catch (e) {
    console.log(e);
  }
  return Promise.all(tasks).
      then(data => data.map(items => this.prepare(items)));
};

module.exports = MongoStat;
