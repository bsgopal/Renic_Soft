import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isUsingMock } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'mockDb.json');

let store = {};

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    store = {};
    persist();
  } else {
    try {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      store = {};
    }
  }
};

const persist = () => {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
};

const col = (name) => {
  if (!store[name]) store[name] = [];
  return store[name];
};

const genId = () => {
  const hex = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return hex() + hex() + hex() + hex();
};

const toObjId = (v) => (v && v._id ? String(v._id) : v);

import mongoose from 'mongoose';
import Application from './Application.js';
import ApplicationSyncLog from './ApplicationSyncLog.js';
import Bill from './Bill.js';
import Client from './Client.js';
import PlanTier from './PlanTier.js';
import Quotation from './Quotation.js';
import Setting from './Setting.js';
import TenantActivityLog from './TenantActivityLog.js';
import User from './User.js';

const STATIC_MODELS = {
  Application,
  ApplicationSyncLog,
  Bill,
  Client,
  PlanTier,
  Quotation,
  Setting,
  TenantActivityLog,
  User
};

const getModel = async (model) => {
  return STATIC_MODELS[model] || mongoose.models[model] || mongoose.model(model);
};

/**
 * dbHelper - transparent data access layer.
 * Uses Mongoose models when MongoDB is active, otherwise falls back
 * to a JSON file store. Both modes share the same API surface.
 */
export const dbHelper = {
  isMock() {
    return isUsingMock();
  },

  async create(model, data) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.create(data);
    }
    ensureDataDir();
    const doc = { ...data, _id: data._id || genId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    col(model).push(doc);
    persist();
    return doc;
  },

  async find(model, filter = {}) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.find(filter).lean();
    }
    ensureDataDir();
    const rows = col(model);
    return rows.filter((d) =>
      Object.entries(filter).every(([k, v]) => String(d[k]) === String(v))
    );
  },

  async findOne(model, filter = {}) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.findOne(filter).lean();
    }
    ensureDataDir();
    const rows = col(model);
    return rows.find((d) =>
      Object.entries(filter).every(([k, v]) => String(d[k]) === String(v))
    ) || null;
  },

  async findById(model, id) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.findById(id).lean();
    }
    return this.findOne(model, { _id: id });
  },

  async findByIdAndUpdate(model, id, updates) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.findByIdAndUpdate(id, updates, { new: true }).lean();
    }
    ensureDataDir();
    const rows = col(model);
    const idx = rows.findIndex((d) => toObjId(d._id) === toObjId(id));
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...updates, _id: rows[idx]._id, updatedAt: new Date().toISOString() };
    persist();
    return rows[idx];
  },

  async deleteById(model, id) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.findByIdAndDelete(id);
    }
    ensureDataDir();
    const rows = col(model);
    const idx = rows.findIndex((d) => toObjId(d._id) === toObjId(id));
    if (idx === -1) return null;
    const [removed] = rows.splice(idx, 1);
    persist();
    return removed;
  },

  async countDocuments(model, filter = {}) {
    if (!isUsingMock()) {
      const Model = await getModel(model);
      return Model.countDocuments(filter);
    }
    ensureDataDir();
    return this.find(model, filter).then((rows) => rows.length);
  }
};

export default dbHelper;
