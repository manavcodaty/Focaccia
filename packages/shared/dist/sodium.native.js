"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSodium = getSodium;
const react_native_libsodium_1 = __importDefault(require("@more-tech/react-native-libsodium"));
let sodiumPromise;
async function getSodium() {
    if (!sodiumPromise) {
        sodiumPromise = (async () => {
            const nativeSodium = react_native_libsodium_1.default;
            if (nativeSodium.ready) {
                await nativeSodium.ready;
            }
            return nativeSodium;
        })();
    }
    return sodiumPromise;
}
//# sourceMappingURL=sodium.native.js.map