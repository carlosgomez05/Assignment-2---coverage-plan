import { test, expect } from '@playwright/test';

// UI / system tests: four end-to-end journeys chosen from the Assignment 1 risk
// register. Each journey books on its own future date, so the tests are
// independent of each other and of when they run.
//
// Journey -> A1 risk
//  1. guest books an appointment        R1 booking integrity (the #1 damage risk), R7 usability
//  2. guest changes a booking           R2 / R4 availability freed correctly on cancel+rebook
//  3. guest cancels a booking           R2 availability freed on cancel
//  4. second guest, taken slot          R1 double booking (critical), the booking-integrity core

// Next occurrence of a weekday (1 = Monday ... 6 = Saturday). When today is already
// that weekday, jump to next week so the chosen slot is always in the future.
const nextWeekday = (day, weeksAhead = 0) => {
  const d = new Date();
  const offset = (day - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + offset + weeksAhead * 7);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Alex Rivera works Mon-Fri with 30-minute slots, so every test picks a weekday.
const openProvider = async (page, date) => {
  await page.goto('/');
  await page.locator('#date').fill(date);
  await page.locator('#provider').selectOption({ label: 'Alex Rivera (Barber)' });
  await expect(page.locator('#slots button').first()).toBeEnabled();
};

const slotButton = (page, time) =>
  page.locator('#slots button', { hasText: new RegExp(`^${time}$`) });

const bookSlot = async (page, time, name = 'Warren Bwogi', email = 'warren@test.com') => {
  await slotButton(page, time).click();
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#confirm').click();
};

// Guest bookings are confirmed with a message that includes the ID and manage code.
const manageInfoFromMessage = async (page) => {
  const text = await page.locator('#bookMsg').innerText();
  const match = text.match(/ID:\s*(\S+)\s+Manage code:\s*(\S+)/);
  if (!match) throw new Error(`booking message did not include ID/manage code: "${text}"`);
  return { id: match[1], code: match[2] };
};

const cancelAsGuest = async (page, { id, code }) => {
  await page.locator('#apptId').fill(id);
  await page.locator('#token').fill(code);
  await page.locator('#cancelGuest').click();
};

test('book: guest books an appointment and the slot is held', async ({ page }) => {
  // Arrange
  await openProvider(page, nextWeekday(1));

  // Act
  await bookSlot(page, '09:00');

  // Assert: confirmation with the manage details, and the slot no longer offered
  await expect(page.locator('#bookMsg')).toContainText('Booked');
  await expect(page.locator('#bookMsg')).toContainText('Manage code');
  await expect(slotButton(page, '09:00')).toBeDisabled();
});

test('change: guest moves a booking to another slot by cancelling and rebooking', async ({ page }) => {
  // Arrange
  await openProvider(page, nextWeekday(2));
  await bookSlot(page, '09:00');
  await expect(page.locator('#bookMsg')).toContainText('Booked');
  const { id, code } = await manageInfoFromMessage(page);

  // Act: move the appointment - the current UI has no reschedule control, so a
  // change is a cancel followed by a re-book of the new slot.
  await cancelAsGuest(page, { id, code });
  await expect(page.locator('#guestMsg')).toContainText('Appointment cancelled.');
  await expect(slotButton(page, '09:00')).toBeEnabled();
  await bookSlot(page, '09:30');

  // Assert: the old slot is free again and the new one is held
  await expect(page.locator('#bookMsg')).toContainText('Booked');
  await expect(slotButton(page, '09:00')).toBeEnabled();
  await expect(slotButton(page, '09:30')).toBeDisabled();
});

test('cancel: guest cancels with the manage code and the slot is freed', async ({ page }) => {
  // Arrange
  await openProvider(page, nextWeekday(3));
  await bookSlot(page, '10:00');
  await expect(page.locator('#bookMsg')).toContainText('Booked');
  const { id, code } = await manageInfoFromMessage(page);

  // Act
  await cancelAsGuest(page, { id, code });

  // Assert
  await expect(page.locator('#guestMsg')).toContainText('Appointment cancelled.');
  await expect(slotButton(page, '10:00')).toBeEnabled();
});

test('double booking: a second guest sees the taken slot as unavailable', async ({
  page,
  browser,
}) => {
  // Arrange: the first guest books 11:00 on the shared date
  const date = nextWeekday(4);
  await openProvider(page, date);
  await bookSlot(page, '11:00', 'First Guest', 'first@test.com');
  await expect(page.locator('#bookMsg')).toContainText('Booked');

  // Act: a second guest opens the app and looks at the same provider and date
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await openProvider(secondPage, date);

  // Assert: the taken slot is not offered to the second guest
  await expect(slotButton(secondPage, '11:00')).toBeDisabled();

  await secondContext.close();
});
