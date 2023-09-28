export const SENTINEL_MODULES = "0x0000000000000000000000000000000000000001";

export enum ModuleType {
    Plugin = 1,
    FunctionHandler = 2,
    Hooks = 4,
}

export enum ExecutionType {
    MultiSignature,
    Module,
}
