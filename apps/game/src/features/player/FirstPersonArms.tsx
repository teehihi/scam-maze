import React from 'react';
export { ARMS_MODEL_PATH } from './runtime/CharacterAssetCache';

export interface FirstPersonArmsProps {
  isMoving?: boolean;
  isSprinting?: boolean;
  isPunching?: boolean;
  isBlocking?: boolean;
  isInteracting?: boolean;
  isInspecting?: boolean;
}

/**
 * Backward compatibility stub.
 * In the unified architecture, FirstPersonArmsViewmodel is managed directly by CharacterRuntime.
 */
export const FirstPersonArms: React.FC<FirstPersonArmsProps> = () => {
  return null;
};
