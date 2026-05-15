// Adapter to make pg pool work with sqlite-like syntax
const pool = require('./database');

class QueryAdapter {
  prepare(sql) {
    // Convert SQLite placeholders (?) to PostgreSQL ($1, $2, etc)
    let paramCount = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);

    return {
      run: (...params) => {
        return pool.query(pgSql, params);
      },
      get: (...params) => {
        return pool.query(pgSql, params).then(result => result.rows[0]);
      },
      all: (...params) => {
        return pool.query(pgSql, params).then(result => result.rows);
      }
    };
  }

  exec(sql) {
    return pool.query(sql);
  }
}

module.exports = new QueryAdapter();
