import { EventEmitter } from "node:events";

const globalForBus = globalThis as unknown as { seedlingBus?: EventEmitter };

export const bus = globalForBus.seedlingBus ?? new EventEmitter();
bus.setMaxListeners(200);
globalForBus.seedlingBus = bus;
