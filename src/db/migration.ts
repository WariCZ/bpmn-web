import knex, { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema
    .createTable("wf_instances", (table) => {
      //   table.increments(); // Primary key, auto-increment
      table.text("id").unique().notNullable(); // Unique Id
      table.text("itemKey"); // Application assigned key
      table.text("elementId"); // Bpmn element
      table.text("name"); // Name of bpmn element
      table.text("type"); // Bpmn element type
      table.text("instanceId"); // Instance Id of the item
      table.text("processName"); // Process name
      table.text("tokenId"); // Execution Token
      table.text("userName");
      table.dateTime("startedAt"); // Date and time when item started
      table.dateTime("endedAt"); // Date and time when item ended
      table.text("seq");
      table.dateTime("timeDue"); // Due date
      table.text("status"); // Status
      table.text("messageId");
      table.text("signalId");
      table.jsonb("vars"); // JSON data
      table.jsonb("items"); // JSON data
      table.jsonb("data"); // JSON data
      table.text("assignee");
      table.text("candidateGroups");
      table.text("candidateUsers");
      table.text("version");
      table.text("tokens");

      table.jsonb("loops"); // JSON data
      table.jsonb("logs"); // JSON data
      table.jsonb("savePoints"); // JSON data
      table.dateTime("saved");

      table.dateTime("dueDate"); // Due date
      table.dateTime("followUpDate"); // Follow-up date
      table.text("priority");
    })
    .createTable("wf_models", (table) => {
      table.increments(); // Primary key, auto-increment
      table.text("name");
      table.text("source");
      table.text("svg");
      table.text("owner");
      table.dateTime("saved");
      table.text("processes"); // JSON data
      table.text("events"); // JSON data
    })
    .createTable("wf_locks", (table) => {
      //   table.increments(); // Primary key, auto-increment
      table.text("id").unique().notNullable(); // Unique Id
      table.text("server").notNullable(); // Item key
      table.dateTime("time").notNullable(); // Locked at datetime
    })
    .createTable("wf_events", (table) => {
      table.jsonb("events");
    });
};

export const down = (knex: any) => {
  return knex.schema
    .dropTable("wf_instances")
    .dropTable("wf_models")
    .dropTable("wf_locks")
    .dropTable("wf_events");
};
