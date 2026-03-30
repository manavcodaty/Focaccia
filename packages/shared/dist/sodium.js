"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSodium = getSodium;
const libsodium_wrappers_1 = __importDefault(require("libsodium-wrappers"));
let sodiumPromise;
async function getSodium() {
    if (!sodiumPromise) {
        sodiumPromise = (async () => {
            const sodiumModule = libsodium_wrappers_1.default;
            await sodiumModule.ready;
            return sodiumModule;
        })();
    }
    return sodiumPromise;
}
//# sourceMappingURL=sodium.js.map