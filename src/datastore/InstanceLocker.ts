import { DataStore } from "./DataStore";

const COLLECTION = "wf_locks";
const WAIT = 1500;
const MAX_TRIES = 20;

class InstanceLocker {
  dataStore;

  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  translateFilterToKnex(filter) {
    const knexConditions = [];

    for (const key in filter) {
      if (filter.hasOwnProperty(key)) {
        const conditions = filter[key];

        for (const operator in conditions) {
          if (conditions.hasOwnProperty(operator)) {
            const value = conditions[operator];

            switch (operator) {
              case "$lte":
                knexConditions.push({ column: key, operator: "<=", value });
                break;
              case "$gte":
                knexConditions.push({ column: key, operator: ">=", value });
                break;
              case "$lt":
                knexConditions.push({ column: key, operator: "<", value });
                break;
              case "$gt":
                knexConditions.push({ column: key, operator: ">", value });
                break;
              case "$eq":
                knexConditions.push({ column: key, operator: "=", value });
                break;
              case "$ne":
                knexConditions.push({ column: key, operator: "<>", value });
                break;
              // Přidejte další operátory podle potřeby
              default:
                console.warn(`Neznámý operátor: ${operator}`);
            }
          }
        }
      }
    }

    return knexConditions;
  }

  async lock(id) {
    let counter = 0;
    let failed = true;

    while (counter++ < MAX_TRIES && failed) {
      failed = !(await this.try(id));
      if (failed) await this.delay(WAIT, {});
    }

    if (failed) {
      await this.list();
      throw new Error("failed to lock instance: " + id);
    } else {
      return true;
    }
  }

  async try(id) {
    const lock = {
      id: id,
      server: typeof process !== "undefined" ? process.env.SERVER_ID : null,
      time: new Date(),
    };

    try {
      await this.dataStore.db(COLLECTION).insert(lock);
    } catch (err) {
      return false; // Locking failed, possibly due to a duplicate entry.
    }

    return true;
  }

  async release(id) {
    const query = { id: id };
    return await this.dataStore.db(COLLECTION).where(query).del();
  }

  async delete(filter) {
    const conditions = this.translateFilterToKnex(filter);

    const query = this.dataStore.db(COLLECTION);
    conditions.forEach((condition) => {
      query.where(condition.column, condition.operator, condition.value);
    });

    return await query.del();
  }

  async list() {
    return await this.dataStore.db(COLLECTION).select("*");
  }

  async delay(time, result) {
    return new Promise(function (resolve) {
      setTimeout(() => resolve(result), time);
    });
  }
}

export { InstanceLocker };
