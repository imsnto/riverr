// src/lib/error-emitter.ts
import { EventEmitter } from 'events';

// We use the 'events' module polyfill provided by Node.js for browser environments.
// This is a reliable and well-tested way to handle event emitting.
export const errorEmitter = new EventEmitter();
