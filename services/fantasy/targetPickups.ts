import type { PickupRow } from './pickups';
import { SLOT_ORDER } from './positions';

/** A forward filter alone loses C/LW/RW eligibility; preserve the requested exact slot. */
export function targetPickups(rows: PickupRow[], rawSlot?: string): PickupRow[] {
  const slot = SLOT_ORDER.find((entry) => entry === rawSlot);
  return slot ? rows.filter((row) => row.slots.includes(slot)) : rows;
}
