import { CharacterArmsViewmodel, ARMS_MODEL_PATH } from '../../player';

export { ARMS_MODEL_PATH };

/**
 * Re-exports the unified CharacterArmsViewmodel as HueFirstPersonArms
 * to ensure 100% backward compatibility and eliminate duplicate implementations.
 */
export class HueFirstPersonArms extends CharacterArmsViewmodel {}
