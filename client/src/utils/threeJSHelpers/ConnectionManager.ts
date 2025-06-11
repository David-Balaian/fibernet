// src/utils/threeJSHelpers/ConnectionManager.ts
import * as THREE from 'three';

/**
 * Manages the vertical positioning of fiber connections to prevent them from overlapping.
 */
export class ConnectionManager {
    private occupiedSlots = new Set<number>();

    // The vertical distance between each connection path.
    private static readonly SLOT_HEIGHT = 0.2;

    // The starting Y-coordinate for the highest connection. Connections will be created below this point.
    private static readonly BASE_Y_LEVEL = 0;

    /**
     * Finds the first available vertical slot, marks it as occupied, and returns its index.
     * @returns The index of the acquired slot.
     */
    public acquireSlot(): number {
        let slotIndex = 0;
        while (this.occupiedSlots.has(slotIndex)) {
            slotIndex++;
        }
        this.occupiedSlots.add(slotIndex);
        console.log(`[ConnectionManager] Acquired slot: ${slotIndex}`);
        return slotIndex;
    }

    /**
     * Marks a slot as no longer being occupied.
     * @param slotIndex The index of the slot to release.
     */
    public releaseSlot(slotIndex: number): void {
        this.occupiedSlots.delete(slotIndex);
        console.log(`[ConnectionManager] Released slot: ${slotIndex}`);
    }

    /**
     * Translates a slot index into a specific Y-coordinate in the world.
     * @param slotIndex The index of the slot.
     * @returns The calculated Y-coordinate for the connection path.
     */
    public getOffsetY(slotIndex: number): number {
        // We subtract so that slot 0 is the highest, slot 1 is below it, and so on.
        return ConnectionManager.BASE_Y_LEVEL + (slotIndex * ConnectionManager.SLOT_HEIGHT);
    }
}