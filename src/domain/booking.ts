/** Calendar date in the room's time zone, `YYYY-MM-DD`. */
export type IsoDate = string;

/** Wall-clock time in the room's time zone, `HH:mm`. */
export type TimeString = string;

export interface Booking {
  id: string;
  date: IsoDate;
  start: TimeString;
  end: TimeString;
  title?: string;
}

export type BookingInput = Omit<Booking, 'id'>;

export interface TimeRange {
  start: TimeString;
  end: TimeString;
}

/** "Now" expressed in the room's time zone. */
export interface RoomNow {
  date: IsoDate;
  /** Minutes since midnight. */
  minutes: number;
}

export type BookingPhase = 'past' | 'ongoing' | 'upcoming';
