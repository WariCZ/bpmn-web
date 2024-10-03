import knex from "knex";
import {
  DataHandler,
  Execution,
  IDataStore,
  IBPMNServer,
  IInstanceData,
  IItemData,
  ServerComponent,
  //   InstanceLocker,
  QueryTranslator,
} from "../";

// import { DataHandler } from "../engine";
// import { Execution } from "../engine/Execution";
// import {
//   IDataStore,
//   IBPMNServer,
//   IInstanceData,
//   IItemData,
// } from "../interfaces";
// import { ServerComponent } from "../server/ServerComponent";
import { InstanceLocker } from "./";
// import { QueryTranslator } from "./QueryTranslator";

import { db } from "../db/knex";
import { prepareConditions } from "./knex";

export const Instance_collection = "wf_instances";
export const Locks_collection = "wf_locks";
export const Archive_collection = "wf_archives";

class DataStore extends ServerComponent implements IDataStore {
  dbConfiguration;
  db;

  execution: Execution;
  isModified = false;
  isRunning = false;
  inSaving = false;
  promises = [];
  locker;
  enableSavePoints = false;

  constructor(server: IBPMNServer) {
    super(server);
    this.db = db;
    // this.db = {
    //   knex: db,
    //   find: (...args) => {
    //     console.log("args", args);
    //     debugger;
    //   },
    // };
    // dbConfiguration = {
    //   db: {},
    // };
    this.locker = new InstanceLocker(this);
  }

  async save(instance, options = {}) {
    return await this.saveInstance(instance);
  }

  async loadInstance(instanceId, options = {}) {
    const recs = await this.findInstances({ id: instanceId }, "full");
    if (recs.length == 0) {
      this.logger.error("Instance is not found for this item");
      return null;
    }
    const instanceData = recs[0];
    return {
      instance: instanceData,
      items: this.getItemsFromInstances([instanceData]),
    };
  }

  private getItemsFromInstances(instances, condition = null, trans = null) {
    const items = [];
    instances.forEach((instance) => {
      instance.items.forEach((i) => {
        let pass = true;

        // TODO: neni implementovano ELSE
        pass = i.id == condition.bindings[0];
        //if (trans) pass = trans.filterItem(i, condition);

        if (pass) {
          let data;
          if (instance.tokens[i.tokenId]) {
            let dp = instance.tokens[i.tokenId].dataPath;
            if (dp !== "") data = DataHandler.getData(instance.data, dp);
            else data = instance.data;
          } else data = instance.data;

          i["processName"] = instance.name;
          i["data"] = data;
          i["instanceId"] = instance.id;
          i["instanceVersion"] = instance.version;
          items.push(i);
        }
      });
    });
    return items.sort((a, b) => a.seq - b.seq);
  }

  static seq = 0;
  private async saveInstance(instance, options = {}) {
    let saveObject = {
      version: instance.version,
      endedAt: instance.endedAt,
      status: instance.status,
      saved: instance.saved,
      tokens: JSON.stringify(instance.tokens),
      items: JSON.stringify(instance.items),
      loops: JSON.stringify(instance.loops),
      logs: JSON.stringify(instance.logs),
      data: JSON.stringify(instance.data),
      parentItemId: instance.parentItemId,
    };

    if (instance.version == null) instance.version = 0;
    else instance.version++;

    if (this.enableSavePoints) {
      let lastItem = instance.items[instance.items.length - 1].id;
      let savePoint = {
        id: lastItem,
        items: JSON.stringify(instance.items),
        loop: JSON.stringify(instance.loops),
        tokens: JSON.stringify(instance.tokens),
        data: JSON.stringify(instance.data),
      };

      if (!instance["savePoints"]) instance["savePoints"] = {};
      instance["savePoints"][lastItem] = savePoint;

      saveObject["savePoints"] = instance["savePoints"];
    }

    if (!instance.saved) {
      instance.items = JSON.stringify(instance.items);
      instance.loops = JSON.stringify(instance.loops);
      instance.tokens = JSON.stringify(instance.tokens);
      instance.logs = JSON.stringify(instance.logs);
      instance.data = JSON.stringify(instance.data);
      instance.savePoints = JSON.stringify(instance.savePoints);

      instance.saved = new Date();

      await db(Instance_collection).insert(instance);
    } else {
      await db(Instance_collection)
        .where({ id: instance.id })
        .update(saveObject);
    }

    this.logger.log("..DataStore: saving Complete");
  }

  async findItem(query): Promise<IItemData> {
    let results = await this.findItems(query);
    if (results.length == 0)
      throw Error("No items found for " + JSON.stringify(query));
    else if (results.length > 1)
      throw Error(
        "More than one record found " + results.length + JSON.stringify(query)
      );
    else return results[0];
  }

  async findInstance(query, options): Promise<IInstanceData> {
    let results = await this.findInstances(query, options);
    if (results.length == 0)
      throw Error("No instance found for " + JSON.stringify(query));
    else if (results.length > 1)
      throw Error(
        "More than one record found " + results.length + JSON.stringify(query)
      );

    return results[0];
  }

  async findInstances(
    query,
    option: "summary" | "full" | any = "summary"
  ): Promise<IInstanceData[]> {
    let projection = null;
    let sort = null;

    if (option == "summary") projection = ["source", "logs"];
    else if (option["projection"]) projection = option["projection"];
    if (option["sort"]) sort = option["sort"];

    const { conditions, values } = prepareConditions(query);

    const records = await db(Instance_collection)
      .select(projection || "*")
      .whereRaw(conditions.join(" AND "), values);
    //   .orderBy(sort); TODO: Translate to knex
    return records;
  }

  async findItems(query): Promise<IItemData[]> {
    const trans = new QueryTranslator("items");
    // const y = trans.translateCriteria(query);
    const { conditions, values } = prepareConditions(query);

    const result = db.raw(conditions.join(" AND "), values);
    const projection = ["id", "data", "name", "version", "items", "tokens"];
    const records = await db(Instance_collection)
      .select(projection)
      .where(result);
    const items = this.getItemsFromInstances(records, result, trans);
    return items;
  }

  async deleteInstances(query) {
    await db(Instance_collection).where(query).del();
  }

  async install() {
    await db.schema.createTableIfNotExists(Instance_collection, (table) => {
      table.increments("id").primary();
      table.json("items");
      table.json("tokens");
      table.string("status");
      table.timestamps(true, true);
    });

    await db.schema.createTableIfNotExists(Locks_collection, (table) => {
      table.increments("id").primary();
    });
  }

  async archive(query) {
    debugger;
    let docs = await db(Instance_collection).where(query).select();
    if (docs.length > 0) {
      await db(Archive_collection).insert(docs);
      await this.deleteInstances(query);
    }

    console.log("total of ", docs.length, " archived");
  }
}

export { DataStore };
