import { BadRequestError } from "../core/errors/AppError.js";

/**
 * Normalizes an appointment date into a canonical 'YYYY-MM-DD' calendar string.
 * This guarantees timezone-independent comparison and deterministic slot indexing.
 *
 * Handles:
 * - String formats: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss.sssZ"
 * - JavaScript Date objects
 */
export function normalizeAppointmentDate(date: string | Date): string {
  if (!date) {
    throw new BadRequestError("Appointment date is required.");
  }

  if (typeof date === "string") {
    const trimmed = date.trim();
    // If string already begins with YYYY-MM-DD (e.g. "2026-11-10" or "2026-11-10T14:10:00.000Z")
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const month = match[2];
      const day = match[3];
      return `${year}-${month}-${day}`;
    }
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new BadRequestError("Invalid appointment date provided.");
  }

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes a time slot string into canonical 'HH:MM AM/PM' format.
 * Guarantees 2-digit hour with leading zero, uppercase meridian, and single spacing.
 *
 * Examples:
 * - "9:00 AM"   -> "09:00 AM"
 * - "09:00am"   -> "09:00 AM"
 * - "2:00 PM"   -> "02:00 PM"
 * - "14:00"     -> "02:00 PM"
 */
export function normalizeTimeSlot(timeSlot: string): string {
  if (!timeSlot || typeof timeSlot !== "string") {
    return "10:00 AM";
  }

  const clean = timeSlot.trim().toUpperCase();

  // Match 12-hour format with optional spacing: e.g. "9:00 AM", "09:00AM", "11:30 PM"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    const hours = String(parseInt(match12[1], 10)).padStart(2, "0");
    const minutes = match12[2];
    const meridian = match12[3].toUpperCase();
    return `${hours}:${minutes} ${meridian}`;
  }

  // Match 24-hour military format: e.g. "14:00", "09:30"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    const meridian = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, "0")}:${minutes} ${meridian}`;
  }

  return clean;
}

/**
 * Converts a date string or Date object into a normalized UTC midnight Date object.
 * Guarantees appointmentDate is stored consistently as 00:00:00.000Z.
 */
export function toMidnightUTCDate(date: string | Date): Date {
  const dateStr = normalizeAppointmentDate(date);
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

