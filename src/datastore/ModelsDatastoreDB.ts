import {
  Definition,
  BPMNServer,
  IBpmnModelData,
  IModelsDatastore,
  IEventData,
  ServerComponent,
  QueryTranslator,
} from "../";

import { db } from "../db/knex";
import { prepareConditions } from "./knex";
import { BpmnModelData } from "./ModelsData";

// import { Definition } from "../elements";
// import { BPMNServer } from "../server";

// import { ServerComponent } from "../server/ServerComponent";
// import { IBpmnModelData, IModelsDatastore, IEventData } from "../interfaces/";

// import { QueryTranslator } from "./QueryTranslator";

const Definition_collection = "wf_models";
const Events_collection = "wf_events";

class ModelsDatastoreDB extends ServerComponent implements IModelsDatastore {
  dbConfiguration;
  db;

  constructor(server: BPMNServer) {
    super(server);
    this.db = db;
  }

  async get(query = {}): Promise<object[]> {
    const list = await this.db(Definition_collection).where(query).select("*");
    return list;
  }

  async getList(query = {}): Promise<string[]> {
    const records = await this.db(Definition_collection)
      .where(query)
      .select("name");

    const list = records.map((r) => ({ name: r.name }));
    return list;
  }

  /*
   *	Load a definition
   */
  async load(name, owner = null): Promise<Definition> {
    console.log("loading ", name, "from db");
    const data = await this.loadModel(name);
    const definition = new Definition(name, data.source, this.server);
    await definition.load();
    return definition;
  }

  async getSource(name, owner = null): Promise<string> {
    const model = await this.loadModel(name);
    return model.source;
  }

  async getSVG(name, owner = null): Promise<string> {
    const model = await this.loadModel(name);
    return model.svg;
  }

  /*
   * Load a definition data record from DB
   */
  async loadModel(name, owner = null): Promise<BpmnModelData> {
    const records = await this.db(Definition_collection)
      .where({ name: name })
      .select("*");

    this.logger.log(`find model for ${name} recs: ${records.length}`);
    return records[0];
  }

  async save(name, source, svg, owner = null): Promise<any> {
    let bpmnModelData = new BpmnModelData(name, source, svg, null, null);
    const definition = new Definition(
      bpmnModelData.name,
      bpmnModelData.source,
      this.server
    );

    try {
      await definition.load();
      bpmnModelData.parse(definition);

      await this.saveModel(bpmnModelData, owner);
      return bpmnModelData;
    } catch (exc) {
      console.log("error in save", exc);
      throw exc;
    }
  }

  async findEvents(query, owner = null): Promise<IEventData[]> {
    const events = [];
    let trans;
    let newQuery = query;

    if (query) {
      trans = new QueryTranslator("events");
      newQuery = trans.translateCriteria(query);

      const { conditions, values } = prepareConditions(query);

      newQuery = db.raw(conditions.join(" AND "), values);
    }

    const records = await this.db(Events_collection)
      .where(newQuery)
      .select("*");

    records.forEach((rec) => {
      rec.events.forEach((ev) => {
        let pass = true;
        if (query) {
          pass = trans.filterItem(ev, newQuery);
        }
        if (pass) {
          ev.modelName = rec.name;
          ev._id = rec._id;
          events.push(ev);
        }
      });
    });

    return events;
  }

  async install() {
    debugger;
    // Use Knex to create indexes or tables if necessary
    await this.db.schema.createTableIfNotExists(
      Definition_collection,
      (table) => {
        table.string("name").unique();
        table.json("source");
        table.json("svg");
        table.timestamps(true, true);
      }
    );

    this.logger.log("Database installation complete.");
  }

  async import(data, owner = null) {
    debugger;
    return await this.db(Definition_collection).insert(data);
  }

  async updateTimer(name, owner = null): Promise<boolean> {
    const source = await this.getSource(name, owner);
    let model = new BpmnModelData(name, source, null, null, null);
    let definition = new Definition(model.name, model.source, this.server);

    await definition.load();
    model.parse(definition);
    debugger;
    await this.db(Definition_collection)
      .where({ name: model.name })
      .update({ events: model.events });

    this.logger.log("updating model");
    return true;
  }

  async saveModel(model: IBpmnModelData, owner = null): Promise<boolean> {
    model.saved = new Date();
    await this.db(Definition_collection)
      .where({ name: model.name, owner: owner })
      .update({
        name: model.name,
        owner: owner,
        saved: model.saved,
        source: model.source,
        svg: model.svg,
        processes: JSON.stringify(model.processes),
        events: JSON.stringify(model.events),
      });
    return true;
  }

  async deleteModel(name, owner = null) {
    await this.db(Definition_collection).where({ name: name }).del();
  }

  async renameModel(name, newName, owner = null) {
    await this.db(Definition_collection)
      .where({ name: name })
      .update({ name: newName });

    this.logger.log("Model renamed successfully.");
    return true;
  }

  async export(name, folderPath, owner = null) {
    const fs = require("fs");
    const model = await this.loadModel(name, owner);

    fs.writeFile(`${folderPath}/${name}.bpmn`, model.source, (err) => {
      if (err) throw err;
      console.log(`Saved BPMN to ${folderPath}/${name}.bpmn`);
    });

    fs.writeFile(`${folderPath}/${name}.svg`, model.svg, (err) => {
      if (err) throw err;
      console.log(`Saved SVG to ${folderPath}/${name}.svg`);
    });
  }

  async rebuild(model = null) {
    // Implement the rebuild logic if needed
  }
}

export { ModelsDatastoreDB };
