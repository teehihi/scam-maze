/**
 * How the room is joined to the neighborhood when it is entered from house no. 59.
 * The room is its own engine; the neighborhood builds it ahead of time ("standby"), shows it when
 * the player walks through the white doorway, and hears back when the player leaves.
 */
export interface RoomOptions {
  /**
   * Build and compile everything but do not run or draw until `Engine.activate()`; the neighborhood
   * does this while the player walks to the door, so the room is ready the moment it is needed.
   */
  standby?: boolean;
  /** The player chose the room's door; the neighborhood starts its white-out. */
  onExitStart?: () => void;
  /** The white-out is done (about 0.6 s later): switch back to the neighborhood. */
  onExit?: () => void;
}
